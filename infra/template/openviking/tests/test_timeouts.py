import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("ovctl_timeouts", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)

SDK_DEFAULT_TIMEOUT = 60  # openviking-sdk 0.1.7 resolve_client_config default


class TimeoutTests(unittest.TestCase):
    """The worker must outlive the server's 600 s index wait; routine clients keep the SDK default."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        patcher = patch.object(ovctl, "OV_DIR", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.sdk_client = Mock(name="SyncHTTPClient")
        sdk = types.ModuleType("openviking_sdk")
        sdk.SyncHTTPClient = self.sdk_client
        modules = patch.dict(sys.modules, {"openviking_sdk": sdk})
        modules.start()
        self.addCleanup(modules.stop)

    def constructed_timeouts(self):
        return [call.kwargs["timeout"] for call in self.sdk_client.call_args_list]

    def test_constants_pin_the_worker_margin_over_the_server_wait(self):
        self.assertEqual(ovctl.INDEX_WAIT_SECONDS, 600)
        self.assertEqual(ovctl.INDEX_HTTP_TIMEOUT_SECONDS, 660)

    def test_default_client_uses_the_sdk_default(self):
        ovctl.client()
        self.sdk_client.assert_called_once_with(url=ovctl.URL, timeout=SDK_DEFAULT_TIMEOUT)
        self.sdk_client.return_value.initialize.assert_called_once()

    def test_durable_worker_constructs_client_with_index_timeout(self):
        source = self.root / "source.md"
        source.write_text("synthetic history")
        ovctl.enqueue_resource(source, "viking://resources/test")
        with patch.object(ovctl, "add_resource", return_value=True):
            self.assertEqual(ovctl.cmd_resume_pending(), 0)
        self.sdk_client.assert_called_once_with(url=ovctl.URL, timeout=660)
        self.assertEqual(self.constructed_timeouts(), [ovctl.INDEX_HTTP_TIMEOUT_SECONDS])

    def test_routine_commands_keep_the_sdk_default(self):
        with patch.object(ovctl, "healthy", return_value=True), patch.object(ovctl, "list_uris", return_value=[]):
            for command in (ovctl.cmd_status, ovctl.cmd_export, lambda: ovctl.cmd_recent(5)):
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(command(), 0)
        self.assertEqual(self.constructed_timeouts(), [SDK_DEFAULT_TIMEOUT] * 3)


if __name__ == "__main__":
    unittest.main()
