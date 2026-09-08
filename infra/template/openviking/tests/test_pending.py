import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("ovctl_pending", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class PendingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        patcher = patch.object(ovctl, "OV_DIR", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        errors = types.ModuleType("openviking_sdk.errors")
        errors.NotFoundError = type("NotFoundError", (Exception,), {})
        modules = patch.dict(sys.modules, {"openviking_sdk": types.ModuleType("openviking_sdk"), "openviking_sdk.errors": errors})
        modules.start()
        self.addCleanup(modules.stop)
        self.source = self.root / "source.md"
        self.source.write_text("private content")
        self.uri = "viking://resources/test"

    def state(self):
        return json.loads((self.root / "pending.json").read_text())

    def test_failed_index_survives_retry_and_clears_after_success(self):
        ovctl.enqueue_resource(self.source, self.uri)
        client = Mock()
        with patch.object(ovctl, "client", return_value=client):
            with patch.object(ovctl, "add_resource", side_effect=TimeoutError):
                self.assertEqual(ovctl.cmd_resume_pending(), 1)
            self.assertIn(self.uri, self.state())
            with patch.object(ovctl, "add_resource", return_value=True) as add:
                self.assertEqual(ovctl.cmd_resume_pending(), 0)
                add.assert_called_once_with(client, self.source, self.uri, wait=True)
        self.assertEqual(self.state(), {})

    def test_new_generation_during_index_is_not_acknowledged(self):
        ovctl.enqueue_resource(self.source, self.uri)
        old = self.state()[self.uri]
        def index(*args, **kwargs):
            ovctl.enqueue_resource(self.source, self.uri)
            return True
        with patch.object(ovctl, "client", return_value=Mock()), patch.object(ovctl, "add_resource", side_effect=index):
            self.assertEqual(ovctl.cmd_resume_pending(), 0)
        self.assertNotEqual(self.state()[self.uri], old)

    def test_failed_commit_preserves_previous_queue(self):
        ovctl.enqueue_resource(self.source, self.uri)
        old = self.state()
        with patch.object(ovctl.os, "replace", side_effect=OSError):
            with self.assertRaises(OSError):
                ovctl.enqueue_resource(self.source, self.uri)
        self.assertEqual(self.state(), old)
        self.assertEqual(list(self.root.glob(".pending-*")), [])

    def test_corruption_does_not_reset_queue(self):
        (self.root / "pending.json").write_text("{broken")
        with self.assertRaises(ValueError):
            ovctl.enqueue_resource(self.source, self.uri)
        self.assertEqual((self.root / "pending.json").read_text(), "{broken")

    def test_forget_cancels_descendants_without_canceling_similar_prefix(self):
        for uri in (self.uri, self.uri + "/child", self.uri + "-other"):
            ovctl.enqueue_resource(self.source, uri)
        with patch.object(ovctl, "client", return_value=Mock()):
            self.assertEqual(ovctl.cmd_rm(self.uri), 0)
        self.assertEqual(list(self.state()), [self.uri + "-other"])

    def test_forget_failure_is_not_reported_as_success(self):
        client = Mock()
        client.rm.side_effect = ConnectionError
        with patch.object(ovctl, "client", return_value=client):
            self.assertEqual(ovctl.cmd_rm(self.uri), 1)
        client.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
