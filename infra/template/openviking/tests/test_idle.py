import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("ovctl_idle", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class IdleTests(unittest.TestCase):
    def check(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(ovctl.cmd_idle_check(1200), 0)
        return json.loads(output.getvalue())

    def test_pending_then_drain_then_full_idle_window(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ovctl.time, "time", return_value=10000) as clock:
            root = Path(directory)
            source = root / "source.md"
            source.write_text("synthetic history")
            with patch.object(ovctl, "OV_DIR", root), patch.object(ovctl, "client", return_value=Mock()), patch.object(ovctl, "add_resource", return_value=True):
                self.assertTrue(self.check()["can_stop"])
                ovctl.enqueue_resource(source, "viking://resources/test")
                self.assertFalse(self.check()["can_stop"])
                ovctl.cmd_resume_pending()
                self.assertEqual(self.check(), {"can_stop": False, "pending": 0, "idle_remaining_seconds": 1200, "stop_claimed": False})
                clock.return_value = 11199
                self.assertFalse(self.check()["can_stop"])
                clock.return_value = 11200
                self.assertTrue(self.check()["can_stop"])
                # A fresh enqueue overrides the old completion receipt.
                ovctl.enqueue_resource(source, "viking://resources/test")
                self.assertFalse(self.check()["can_stop"])

    def test_receipt_failure_keeps_completed_work_pending(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.md"
            source.write_text("synthetic history")
            with patch.object(ovctl, "OV_DIR", root), patch.object(ovctl, "client", return_value=Mock()), patch.object(ovctl, "add_resource", return_value=True):
                ovctl.enqueue_resource(source, "viking://resources/test")
                with patch.object(ovctl, "write_idle_receipt", side_effect=OSError):
                    with self.assertRaises(OSError):
                        ovctl.cmd_resume_pending()
                self.assertEqual(self.check()["pending"], 1)
                self.assertFalse(self.check()["can_stop"])

    def test_corrupt_receipt_cannot_grant_shutdown(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(ovctl, "OV_DIR", root):
                for value in ('{broken', '{"completed_at": "yesterday"}', '{"completed_at": NaN}'):
                    (root / "index-completed.json").write_text(value)
                    with self.assertRaises(ValueError):
                        self.check()


if __name__ == "__main__":
    unittest.main()
