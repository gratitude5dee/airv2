import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("ovctl_replace", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class OpenVikingError(Exception):
    pass


class NotFoundError(OpenVikingError):
    """Stand-in for openviking_sdk.errors.NotFoundError (server code NOT_FOUND)."""


class InternalError(OpenVikingError):
    pass


COMPLETED = {"status": "completed", "root_uri": "viking://resources/test", "queue_status": {}}


class ReplaceTests(unittest.TestCase):
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
        self.uri = "viking://resources/test"

    def state(self):
        return json.loads((self.root / "pending.json").read_text())

    def test_absence_is_harmless_and_proceeds_to_add(self):
        client = Mock()
        client.rm.side_effect = NotFoundError("nothing at uri")
        client.add_resource.return_value = COMPLETED
        self.assertTrue(ovctl.add_resource(client, self.source, self.uri))
        client.add_resource.assert_called_once()

    def test_real_remove_failure_propagates_before_any_add(self):
        for error in (InternalError("storage failure"), ConnectionError(), TimeoutError()):
            client = Mock()
            client.rm.side_effect = error
            with self.assertRaises(type(error)):
                ovctl.add_resource(client, self.source, self.uri)
            client.add_resource.assert_not_called()

    def test_worker_keeps_work_pending_after_failed_remove(self):
        ovctl.enqueue_resource(self.source, self.uri)
        client = Mock()
        client.rm.side_effect = InternalError("storage failure")
        with patch.object(ovctl, "client", return_value=client):
            self.assertEqual(ovctl.cmd_resume_pending(), 1)
        client.add_resource.assert_not_called()
        self.assertIn(self.uri, self.state())
        self.assertFalse((self.root / "index-completed.json").exists())
        client.close.assert_called_once()

    def test_worker_acknowledges_first_ingest_after_absence(self):
        ovctl.enqueue_resource(self.source, self.uri)
        client = Mock()
        client.rm.side_effect = NotFoundError("nothing at uri")
        client.add_resource.return_value = COMPLETED
        with patch.object(ovctl, "client", return_value=client):
            self.assertEqual(ovctl.cmd_resume_pending(), 0)
        self.assertEqual(self.state(), {})
        self.assertTrue((self.root / "index-completed.json").exists())

    def test_forget_treats_absence_as_already_forgotten(self):
        client = Mock()
        client.rm.side_effect = NotFoundError("nothing at uri")
        output = io.StringIO()
        with patch.object(ovctl, "client", return_value=client), contextlib.redirect_stdout(output):
            self.assertEqual(ovctl.cmd_rm(self.uri), 0)
        self.assertEqual(json.loads(output.getvalue()), {"ok": True, "uri": self.uri, "absent": True})
        client.close.assert_called_once()

    def test_forget_reports_other_failures(self):
        client = Mock()
        client.rm.side_effect = InternalError("storage failure")
        output = io.StringIO()
        with patch.object(ovctl, "client", return_value=client), contextlib.redirect_stdout(output):
            self.assertEqual(ovctl.cmd_rm(self.uri), 1)
        self.assertEqual(json.loads(output.getvalue()), {"ok": False, "uri": self.uri, "error": "InternalError"})


if __name__ == "__main__":
    unittest.main()
