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

spec = importlib.util.spec_from_file_location("ovctl_inventory", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class NotFoundError(Exception):
    pass


def entry(uri, is_dir=False, mod_time=None):
    node = {"uri": uri, "isDir": is_dir}
    if mod_time is not None:
        node["modTime"] = mod_time
    return node


class FakeClient:
    """Directory map → `ls` pages; `read` returns per-URI content."""

    def __init__(self, tree, contents=None, missing=()):
        self.tree = tree
        self.contents = contents or {}
        self.missing = set(missing)
        self.ls_calls = []
        self.closed = False

    def ls(self, uri, output="original", node_limit=1000):
        self.ls_calls.append(uri)
        if uri in self.missing:
            raise NotFoundError(uri)
        return self.tree.get(uri, [])

    def read(self, uri, limit=1024):
        if uri not in self.contents:
            raise RuntimeError("unreadable")
        return self.contents[uri]

    def close(self):
        self.closed = True


class InventoryTests(unittest.TestCase):
    """`status` counts leaves (not directory nodes) and `recent` is newest first (MEM-27)."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        patcher = patch.object(ovctl, "OV_DIR", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        errors = types.ModuleType("openviking_sdk.errors")
        errors.NotFoundError = NotFoundError
        sdk = types.ModuleType("openviking_sdk")
        sdk.errors = errors
        modules = patch.dict(sys.modules, {"openviking_sdk": sdk, "openviking_sdk.errors": errors})
        modules.start()
        self.addCleanup(modules.stop)

    def run_status(self, fake):
        out = io.StringIO()
        with patch.object(ovctl, "healthy", return_value=True), \
                patch.object(ovctl, "client", return_value=fake), \
                contextlib.redirect_stdout(out):
            self.assertEqual(ovctl.cmd_status(), 0)
        return json.loads(out.getvalue())

    def run_recent(self, fake, limit=5):
        out = io.StringIO()
        with patch.object(ovctl, "healthy", return_value=True), \
                patch.object(ovctl, "client", return_value=fake), \
                contextlib.redirect_stdout(out):
            self.assertEqual(ovctl.cmd_recent(limit), 0)
        return json.loads(out.getvalue())

    def test_walk_descends_directories_and_tolerates_absent_root(self):
        fake = FakeClient({
            "viking://resources/context": [
                entry("viking://resources/context/imessage-history", is_dir=True),
                entry("viking://resources/context/dictionary"),
            ],
            "viking://resources/context/imessage-history": [
                entry("viking://resources/context/imessage-history/threads", is_dir=True),
            ],
            "viking://resources/context/imessage-history/threads": [
                entry("viking://resources/context/imessage-history/threads/t1", is_dir=True),
            ],
            "viking://resources/context/imessage-history/threads/t1": [
                entry("viking://resources/context/imessage-history/threads/t1/2026-01"),
                entry("viking://resources/context/imessage-history/threads/t1/2026-02"),
            ],
        }, missing={"viking://user"})
        entries, truncated = ovctl.walk_entries(fake, "viking://resources/context")
        self.assertFalse(truncated)
        self.assertEqual(len(entries), 6)
        self.assertEqual(len(ovctl.leaf_entries(entries)), 3)
        self.assertEqual(ovctl.walk_entries(fake, "viking://user"), ([], False))

    def test_walk_propagates_non_absence_failures(self):
        fake = FakeClient({})
        fake.ls = Mock(side_effect=RuntimeError("boom"))
        with self.assertRaises(RuntimeError):
            ovctl.walk_entries(fake, "viking://resources/context")

    def test_walk_flags_truncation(self):
        page = [entry(f"viking://user/m{i}") for i in range(ovctl.LS_PAGE_LIMIT)]
        entries, truncated = ovctl.walk_entries(FakeClient({"viking://user": page}), "viking://user")
        self.assertTrue(truncated)
        self.assertEqual(len(entries), ovctl.LS_PAGE_LIMIT)
        entries, truncated = ovctl.walk_entries(FakeClient({"viking://user": page[:10]}), "viking://user", limit=4)
        self.assertTrue(truncated)
        self.assertEqual(len(entries), 4)

    def test_status_reports_leaf_counts_for_resources_and_memories(self):
        fake = FakeClient({
            "viking://resources/context": [
                entry("viking://resources/context/agent-import", is_dir=True),
                entry("viking://resources/context/onairos"),
            ],
            "viking://resources/context/agent-import": [
                entry("viking://resources/context/agent-import/hermes", is_dir=True),
            ],
            "viking://resources/context/agent-import/hermes": [
                entry("viking://resources/context/agent-import/hermes/a.md"),
                entry("viking://resources/context/agent-import/hermes/b.md"),
            ],
            "viking://user": [
                entry("viking://user/memories", is_dir=True),
            ],
            "viking://user/memories": [
                entry("viking://user/memories/m1"),
                entry("viking://user/memories/m2"),
                entry("viking://user/memories/m3"),
            ],
        })
        status = self.run_status(fake)
        self.assertEqual(status["resources"], 3)
        self.assertEqual(status["memories"], 3)
        self.assertFalse(status["truncated"])
        self.assertTrue(status["healthy"])
        self.assertTrue(fake.closed)

    def test_status_degrades_when_the_listing_fails(self):
        fake = FakeClient({})
        fake.ls = Mock(side_effect=RuntimeError("boom"))
        status = self.run_status(fake)
        self.assertFalse(status["healthy"])
        self.assertEqual(status["resources"], 0)
        self.assertEqual(status["memories"], 0)
        self.assertTrue(fake.closed)

    def test_status_never_prints_content(self):
        fake = FakeClient(
            {"viking://user": [entry("viking://user/m1")]},
            contents={"viking://user/m1": "SECRET memory text"},
        )
        out = io.StringIO()
        with patch.object(ovctl, "healthy", return_value=True), \
                patch.object(ovctl, "client", return_value=fake), \
                contextlib.redirect_stdout(out):
            ovctl.cmd_status()
        self.assertNotIn("SECRET", out.getvalue())

    def test_recent_first_orders_by_mod_time_then_uri(self):
        ordered = ovctl.recent_first([
            entry("viking://user/b", mod_time="2026-01-01T00:00:00Z"),
            entry("viking://user/undated-a"),
            entry("viking://user/c", mod_time="2026-03-01T00:00:00.5+00:00"),
            entry("viking://user/a", mod_time="2026-01-01T00:00:00Z"),
            entry("viking://user/undated-z"),
            entry("viking://user/garbage", mod_time="not a time"),
        ])
        self.assertEqual(
            [node["uri"] for node in ordered],
            ["viking://user/c", "viking://user/a", "viking://user/b",
             "viking://user/undated-z", "viking://user/undated-a", "viking://user/garbage"],
        )

    def test_recent_previews_newest_leaves_and_skips_directories(self):
        fake = FakeClient(
            {
                "viking://resources": [entry("viking://resources/context", is_dir=True)],
                "viking://user": [
                    entry("viking://user/memories", is_dir=True),
                    entry("viking://user/old", mod_time="2025-01-01T00:00:00Z"),
                ],
                "viking://user/memories": [
                    entry("viking://user/memories/new", mod_time="2026-05-01T00:00:00Z"),
                    entry("viking://user/memories/mid", mod_time="2026-01-01T00:00:00Z"),
                    entry("viking://user/memories/unreadable", mod_time="2026-06-01T00:00:00Z"),
                ],
            },
            contents={
                "viking://user/old": "old",
                "viking://user/memories/new": "n" * 1000,
                "viking://user/memories/mid": "mid",
            },
        )
        recent = self.run_recent(fake, limit=2)
        self.assertEqual(
            [m["uri"] for m in recent["memories"]],
            ["viking://user/memories/new", "viking://user/memories/mid"],
        )
        self.assertEqual(len(recent["memories"][0]["preview"]), 240)
        self.assertEqual(recent["resources"], ["viking://resources/context"])
        self.assertTrue(fake.closed)


if __name__ == "__main__":
    unittest.main()
