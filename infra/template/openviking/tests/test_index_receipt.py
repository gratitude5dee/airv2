import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("ovctl_receipt", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class ReceiptTests(unittest.TestCase):
    def test_only_completed_receipts_acknowledge_work(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "context.md"
            source.write_text("synthetic context")
            uri = "viking://resources/context/test"
            cases = [
                ({"root_uri": uri, "status": "success"}, True),
                ({"root_uri": uri, "queue_status": {"embedding": {"error_count": 0}}}, True),
                ({"status": "cancelled"}, False),
                ({"status": "error", "errors": ["failure"]}, False),
                ({"root_uri": uri, "errors": ["partial failure"]}, False),
                ({"root_uri": uri, "task_id": "still-pending"}, False),
                ({"root_uri": uri, "status": "processing"}, False),
                ({"root_uri": uri, "queue_status": {"embedding": {"error_count": 1}}}, False),
                ({"root_uri": uri, "queue_status": None}, False),
                ({}, False), (None, False),
            ]
            for result, expected in cases:
                with self.subTest(result=result):
                    client = Mock()
                    client.add_resource.return_value = result
                    self.assertEqual(ovctl.add_resource(client, source, uri), expected)
                    client.add_resource.assert_called_once_with(str(source), to=uri, wait=True, timeout=600, strict=True)

    def test_error_result_keeps_durable_entry_for_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "context.md"
            source.write_text("synthetic context")
            uri = "viking://resources/context/test"
            client = Mock()
            client.add_resource.return_value = {"status": "cancelled"}
            with patch.object(ovctl, "OV_DIR", root), patch.object(ovctl, "client", return_value=client):
                ovctl.enqueue_resource(source, uri)
                self.assertEqual(ovctl.cmd_resume_pending(), 1)
                with ovctl.pending_state() as state:
                    self.assertIn(uri, state)
                client.add_resource.return_value = {"root_uri": uri}
                self.assertEqual(ovctl.cmd_resume_pending(), 0)
                with ovctl.pending_state() as state:
                    self.assertEqual(state, {})


if __name__ == "__main__":
    unittest.main()
