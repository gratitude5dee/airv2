import contextlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ovctl", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class ConfigurationTests(unittest.TestCase):
    def test_template_then_fork_credentials_and_rotation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env = root / ".env"
            config = root / "ov.conf"
            with patch.object(ovctl, "ENV_FILE", env), patch.object(ovctl, "OV_DIR", root), patch.object(ovctl, "CONF", config):
                env.write_text("OPENAI_BASE_URL=https://gateway.test/v1\nOPENAI_API_KEY=PLACEHOLDER\n")
                self.assertTrue(ovctl.write_conf())
                self.assertNotIn("vlm", json.loads(config.read_text()))
                for key in ("fork-key", "rotated-key"):
                    env.write_text(f"OPENAI_BASE_URL=https://gateway.test/v1\nOPENAI_API_KEY={key}\n")
                    output = io.StringIO()
                    with patch.object(ovctl.subprocess, "run") as run, patch.object(ovctl, "healthy") as health, contextlib.redirect_stdout(output):
                        self.assertEqual(ovctl.cmd_ensure(configure_only=True), 0)
                        run.assert_not_called()
                        health.assert_not_called()
                    self.assertNotIn(key, output.getvalue())
                    self.assertEqual(json.loads(config.read_text())["vlm"]["api_key"], key)
                    self.assertEqual(stat.S_IMODE(config.stat().st_mode), 0o600)
                    self.assertFalse(ovctl.write_conf())

    def test_failed_atomic_replace_preserves_previous_config(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "ov.conf"
            config.write_text("previous config")
            with patch.object(ovctl, "OV_DIR", root), patch.object(ovctl, "CONF", config), patch.object(ovctl, "render_conf", return_value={}), patch.object(ovctl.os, "replace", side_effect=OSError("disk failure")):
                with self.assertRaises(OSError):
                    ovctl.write_conf()
                self.assertEqual(config.read_text(), "previous config")
                self.assertEqual(list(root.glob(".ov-conf-*")), [])

    def test_service_uses_non_recursive_configuration_and_sync_ensures_health(self):
        template = Path(__file__).resolve().parents[2]
        unit = (template / "openviking.service").read_text()
        self.assertIn("ExecStartPre=/usr/local/bin/ovctl ensure --configure-only", unit)
        self.assertIn("ExecStartPost=+/bin/systemctl --no-block start openviking-index.service", unit)
        self.assertIn("ExecStart=/usr/local/bin/ovctl resume-pending", (template / "openviking-index.service").read_text())
        self.assertIn("ovctl ensure", (template / "sync-box.sh").read_text())


if __name__ == "__main__":
    unittest.main()
