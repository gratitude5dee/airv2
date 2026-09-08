import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("manage_soul", ROOT / "manage-soul.py")
soul = importlib.util.module_from_spec(spec)
spec.loader.exec_module(soul)


class ManagedSoulTests(unittest.TestCase):
    def test_fresh_and_legacy_boxes_receive_identical_instruction_blocks(self):
        legacy = json.loads((ROOT / "soul-legacy.json").read_text())
        for original in ["", "\n\n".join(legacy)]:
            updated = soul.reconcile(original)
            self.assertEqual(updated.count(soul.START), 1)
            self.assertEqual(updated.count("## Approvals are rows, not promises"), 1)
            self.assertEqual(updated.count("## Numbers come from your ledgers"), 1)
            self.assertIn(soul.managed_block(), updated)
            self.assertEqual(soul.reconcile(updated), updated)

    def test_custom_sections_and_edits_are_preserved(self):
        custom = "## Owner instructions\nKeep my exact punctuation: café!\n"
        edited = "## Texting style\nI prefer long explanations.\n"
        updated = soul.reconcile(custom + edited)
        self.assertIn(custom + edited, updated)

    def test_updates_only_managed_region(self):
        prefix, suffix = "Owner prefix\n", "\nOwner suffix\n"
        original = prefix + soul.START + "\nobsolete\n" + soul.END + suffix
        self.assertEqual(soul.reconcile(original), prefix + soul.managed_block() + suffix)

    def test_malformed_markers_fail_without_overwriting(self):
        for text in [soul.START, soul.END, soul.END + soul.START,
                     soul.START + soul.END + soul.START + soul.END]:
            with self.subTest(text=text), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "SOUL.md"
                path.write_text(text)
                with self.assertRaises(ValueError):
                    soul.apply(path)
                self.assertEqual(path.read_text(), text)

    def test_atomic_migration_backup_permissions_and_check(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "SOUL.md"
            original = "Owner's custom instructions\n"
            path.write_text(original)
            path.chmod(0o640)
            with self.assertRaises(ValueError):
                soul.apply(path, check=True)
            soul.apply(path)
            soul.apply(path, check=True)
            self.assertEqual(path.stat().st_mode & 0o777, 0o640)
            backup = path.with_name("SOUL.md.before-air-managed")
            self.assertEqual(backup.read_text(), original)
            self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
            previous = path.stat().st_mtime_ns
            soul.apply(path)
            self.assertEqual(previous, path.stat().st_mtime_ns)
            self.assertEqual(backup.read_text(), original)

    def test_setup_sync_and_verify_share_the_same_reconciler(self):
        for name in ["setup.sh", "sync-box.sh", "verify-box.sh"]:
            source = (ROOT / name).read_text()
            self.assertIn('"$TEMPLATE_DIR/manage-soul.py" "$HOME_DIR/.hermes/SOUL.md"', source)
            self.assertNotIn("cat >> \"$HOME_DIR/.hermes/SOUL.md\"", source)


if __name__ == "__main__":
    unittest.main()
