import contextlib
import fcntl
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("ovctl_clear", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class OpenVikingError(Exception):
    pass


class NotFoundError(OpenVikingError):
    """Stand-in for openviking_sdk.errors.NotFoundError (server code NOT_FOUND)."""


class InternalError(OpenVikingError):
    pass


RESOURCES = "viking://resources/context"
MEMORIES = "viking://user"


class ClearTests(unittest.TestCase):
    """`ovctl clear` wipes whole roots without letting the durable replay restore them."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        patcher = patch.object(ovctl, "OV_DIR", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        errors = types.ModuleType("openviking_sdk.errors")
        errors.NotFoundError = NotFoundError
        errors.OpenVikingError = OpenVikingError
        sdk = types.ModuleType("openviking_sdk")
        sdk.errors = errors
        modules = patch.dict(sys.modules, {"openviking_sdk": sdk, "openviking_sdk.errors": errors})
        modules.start()
        self.addCleanup(modules.stop)
        self.source = self.root / "source.md"
        self.source.write_text("private content")

    @staticmethod
    def server(**overrides):
        """A client whose cleared roots stay gone unless a test says otherwise."""
        client = Mock()
        client.ls.side_effect = NotFoundError("gone")
        for name, value in overrides.items():
            setattr(client, name, value)
        return client

    def run_json(self, command, *args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status = command(*args)
        return status, json.loads(output.getvalue())

    def clear(self, scope, client):
        with patch.object(ovctl, "client", return_value=client):
            return self.run_json(ovctl.cmd_clear, scope)

    def state(self):
        return json.loads((self.root / "pending.json").read_text())

    def test_resources_scope_removes_only_the_context_root(self):
        client = self.server()
        status, result = self.clear("resources", client)
        self.assertEqual((status, result), (0, {"ok": True, "scope": "resources", "removed": [RESOURCES], "absent": []}))
        client.rm.assert_called_once_with(RESOURCES, recursive=True, wait=True)
        client.wait_processed.assert_called_once_with(timeout=ovctl.CLEAR_SETTLE_SECONDS)
        client.ls.assert_called_once_with(RESOURCES)
        client.close.assert_called_once()

    def test_memories_scope_removes_only_the_user_root(self):
        client = self.server()
        status, result = self.clear("memories", client)
        self.assertEqual((status, result), (0, {"ok": True, "scope": "memories", "removed": [MEMORIES], "absent": []}))
        client.rm.assert_called_once_with(MEMORIES, recursive=True, wait=True)

    def test_all_scope_removes_both_roots(self):
        client = self.server()
        status, result = self.clear("all", client)
        self.assertEqual((status, result), (0, {"ok": True, "scope": "all", "removed": [RESOURCES, MEMORIES], "absent": []}))
        self.assertEqual([call.args[0] for call in client.rm.call_args_list], [RESOURCES, MEMORIES])
        client.close.assert_called_once()

    def test_queued_work_under_the_cleared_root_is_dropped_before_removal(self):
        ovctl.enqueue_resource(self.source, f"{RESOURCES}/imessage-history/threads/a/2024-01")
        ovctl.enqueue_resource(self.source, "viking://resources/other")
        client = self.server()
        observed = {}

        def rm(uri, **kwargs):
            observed["pending"] = list(self.state())

        client.rm.side_effect = rm
        self.assertEqual(self.clear("resources", client)[0], 0)
        self.assertEqual(observed["pending"], ["viking://resources/other"])
        self.assertEqual(list(self.state()), ["viking://resources/other"])
        with patch.object(ovctl, "client", return_value=Mock()), patch.object(ovctl, "add_resource", return_value=True) as add:
            ovctl.cmd_resume_pending()
        add.assert_called_once()
        self.assertEqual(add.call_args.args[2], "viking://resources/other")

    def test_memories_scope_leaves_resource_queue_alone(self):
        ovctl.enqueue_resource(self.source, f"{RESOURCES}/onairos")
        self.assertEqual(self.clear("memories", self.server())[0], 0)
        self.assertEqual(list(self.state()), [f"{RESOURCES}/onairos"])

    def test_typed_absence_is_already_cleared(self):
        client = self.server()
        client.rm.side_effect = NotFoundError("nothing at uri")
        status, result = self.clear("all", client)
        self.assertEqual((status, result), (0, {"ok": True, "scope": "all", "removed": [], "absent": [RESOURCES, MEMORIES]}))
        client.ls.assert_not_called()

    def test_root_recreated_by_a_racing_semantic_refresh_is_removed_again(self):
        # Observed against server 0.4.16: a parent_refresh racing the delete can
        # bring back <root>/.abstract.md (a derived summary) after rm returned.
        client = self.server()
        client.ls.side_effect = [{"name": ".abstract.md"}, NotFoundError("gone")]
        status, result = self.clear("all", client)
        self.assertEqual((status, result), (0, {
            "ok": True, "scope": "all", "removed": [RESOURCES, MEMORIES], "absent": [], "resurrected": [RESOURCES],
        }))
        self.assertEqual([call.args[0] for call in client.rm.call_args_list], [RESOURCES, MEMORIES, RESOURCES])

    def test_recheck_survives_a_server_without_wait_processed(self):
        client = self.server()
        client.wait_processed.side_effect = InternalError("no such endpoint")
        status, result = self.clear("resources", client)
        self.assertEqual((status, result), (0, {"ok": True, "scope": "resources", "removed": [RESOURCES], "absent": []}))
        client.ls.assert_called_once_with(RESOURCES)

    def test_failed_second_removal_is_a_failure(self):
        client = self.server()
        client.ls.side_effect = None
        client.ls.return_value = [{"name": ".abstract.md"}]
        client.rm.side_effect = [None, InternalError("storage failure: private content")]
        status, result = self.clear("resources", client)
        self.assertEqual((status, result), (1, {"ok": False, "scope": "resources", "failed": [RESOURCES], "errors": ["InternalError"]}))
        self.assertNotIn("private content", json.dumps(result))

    def test_real_failure_reports_only_uris_and_acknowledges_nothing(self):
        for error in (InternalError("storage failure: private content"), ConnectionError(), TimeoutError()):
            client = self.server()
            client.rm.side_effect = [error, None]
            status, result = self.clear("all", client)
            self.assertEqual((status, result), (1, {
                "ok": False, "scope": "all", "failed": [RESOURCES], "errors": [type(error).__name__],
            }))
            self.assertNotIn("removed", result)
            self.assertNotIn("private content", json.dumps(result))
            client.close.assert_called_once()

    def test_lock_excludes_a_running_worker(self):
        ovctl.enqueue_resource(self.source, f"{RESOURCES}/onairos")
        started = threading.Event()
        release = threading.Event()
        order = []

        def index(*args, **kwargs):
            started.set()
            release.wait(5)
            order.append("index")
            return True

        client = self.server()
        client.rm.side_effect = lambda *args, **kwargs: order.append("clear")
        with patch.object(ovctl, "client", return_value=client), patch.object(ovctl, "add_resource", side_effect=index):
            thread = threading.Thread(target=ovctl.cmd_resume_pending)
            thread.start()
            self.assertTrue(started.wait(5))
            with (self.root / "pending-worker.lock").open("a") as probe:
                with self.assertRaises(BlockingIOError):
                    fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
            release.set()
            status = self.run_json(ovctl.cmd_clear, "resources")[0]
            thread.join(5)
        self.assertEqual((status, order), (0, ["index", "clear"]))

    def test_clear_holds_the_worker_lock_against_a_stop_claim(self):
        client = self.server()
        observed = {}

        def rm(uri, **kwargs):
            with (self.root / "pending-worker.lock").open("a") as probe:
                try:
                    fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    observed["locked"] = False
                except BlockingIOError:
                    observed["locked"] = True

        client.rm.side_effect = rm
        self.assertEqual(self.clear("memories", client)[0], 0)
        self.assertTrue(observed["locked"])

    def test_cli_wires_scope_and_rejects_unknown_scopes(self):
        client = self.server()
        with patch.object(ovctl, "client", return_value=client), patch.object(ovctl.sys, "argv", ["ovctl", "clear", "--scope", "memories"]):
            status, result = self.run_json(ovctl.main)
        self.assertEqual((status, result["ok"], result["removed"]), (0, True, [MEMORIES]))
        for argv in (["ovctl", "clear", "--scope", "everything"], ["ovctl", "clear"]):
            with patch.object(ovctl.sys, "argv", argv), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as exit_info:
                    ovctl.main()
            self.assertEqual(exit_info.exception.code, 2)
        client.rm.assert_called_once()


if __name__ == "__main__":
    unittest.main()
