import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("ovctl", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class ReindexTests(unittest.TestCase):
    def test_message_documents_match_upload_uris_and_exclude_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            history = root / "history"
            thread = history / "threads" / ("a" * 64)
            thread.mkdir(parents=True)
            document = thread / "2026-09.md"
            document.write_text("private conversation")
            (thread / "2026-09.md.pending-abc").write_text("partial")
            (history / "status.json").write_text("{}")
            (history / "chunk-1.json").write_text("[]")
            client = Mock()
            output = io.StringIO()
            with patch.object(ovctl, "OV_DIR", root / "queue"), patch.object(ovctl, "client", return_value=client), \
                 patch.object(ovctl, "IMESSAGE_DIR", history), \
                 patch.object(ovctl, "ONAIROS_MD", root / "missing"), \
                 patch.object(ovctl, "IMPORT_DIR", root / "missing"), \
                 patch.object(ovctl, "DICTIONARY_MD", root / "missing"), \
                 contextlib.redirect_stdout(output):
                self.assertEqual(ovctl.cmd_reindex(), 1)
            expected = f"{ovctl.IMESSAGE_URI}/threads/{'a' * 64}/2026-09"
            self.assertEqual(json.loads(output.getvalue())["legacy_migration_pending"], 1)
            self.assertEqual(json.loads(output.getvalue())["added"], [expected])
            client.add_resource.assert_not_called()
            pending = json.loads((root / "queue" / "pending.json").read_text())
            self.assertEqual(list(pending), [expected])
            self.assertEqual(pending[expected]["path"], str(document))
            self.assertNotIn("private conversation", output.getvalue())

    def test_recovers_all_context_sources_using_upload_uris(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            imported = root / "agent-import"
            for source in ("hermes", "codex", "claude"):
                (imported / source).mkdir(parents=True)
                (imported / source / "notes.md").write_text("private fixture")
            (imported / "status.json").write_text("{}")
            dictionary = root / "Dictionary.MD"
            dictionary.write_text("private dictionary fixture")
            client = Mock()
            output = io.StringIO()
            with patch.object(ovctl, "OV_DIR", root / "queue"), patch.object(ovctl, "client", return_value=client), \
                 patch.object(ovctl, "IMESSAGE_DIR", root / "absent-messages"), \
                 patch.object(ovctl, "ONAIROS_MD", root / "absent-persona"), \
                 patch.object(ovctl, "IMPORT_DIR", imported), \
                 patch.object(ovctl, "DICTIONARY_MD", dictionary), \
                 contextlib.redirect_stdout(output):
                self.assertEqual(ovctl.cmd_reindex(), 0)
            expected = [f"{ovctl.IMPORT_URI}/{source}" for source in ("hermes", "codex", "claude")]
            expected.append(ovctl.DICTIONARY_URI)
            self.assertEqual(json.loads(output.getvalue())["added"], expected)
            pending = json.loads((root / "queue" / "pending.json").read_text())
            self.assertEqual(list(pending), expected)
            client.add_resource.assert_not_called()
            self.assertNotIn("private", output.getvalue())
            client.close.assert_not_called()


if __name__ == "__main__":
    unittest.main()
