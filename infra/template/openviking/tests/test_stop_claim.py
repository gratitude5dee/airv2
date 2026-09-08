import contextlib
import fcntl
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("ovctl_stop_claim", Path(__file__).resolve().parents[1] / "ovctl.py")
ovctl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ovctl)


class StopClaimTests(unittest.TestCase):
    """The sweeper's stop claim and the durable worker exclude each other."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name, value in (("OV_DIR", self.root), ("BOOT_ID_FILE", self.root / "boot_id")):
            patcher = patch.object(ovctl, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        (self.root / "boot_id").write_text("boot-1\n")
        clock = patch.object(ovctl.time, "time", return_value=10000)
        self.clock = clock.start()
        self.addCleanup(clock.stop)
        self.source = self.root / "source.md"
        self.source.write_text("private content")
        self.uri = "viking://resources/test"

    def run_json(self, command, *args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status = command(*args)
        return status, json.loads(output.getvalue())

    def claim(self, grace=1200, ttl=900):
        return self.run_json(ovctl.cmd_stop_claim, grace, ttl)

    def state(self):
        return json.loads((self.root / "pending.json").read_text())

    def test_idle_box_grants_a_claim_visible_to_idle_check(self):
        status, result = self.claim()
        self.assertEqual(status, 0)
        self.assertTrue(result["claimed"])
        self.assertEqual(result["pending"], 0)
        self.assertEqual(result["expires_at"], 10900)
        self.assertTrue(self.run_json(ovctl.cmd_idle_check, 1200)[1]["stop_claimed"])
        self.assertEqual(json.loads((self.root / "stop-claim.json").read_text())["token"], result["token"])

    def test_pending_work_refuses_a_claim(self):
        ovctl.enqueue_resource(self.source, self.uri)
        status, result = self.claim()
        self.assertEqual(status, 0)
        self.assertEqual((result["claimed"], result["reason"], result["pending"]), (False, "pending", 1))
        self.assertFalse((self.root / "stop-claim.json").exists())

    def test_grace_window_refuses_a_claim(self):
        ovctl.write_idle_receipt()
        self.clock.return_value = 10600
        self.assertEqual(self.claim()[1]["reason"], "grace")
        self.assertEqual(self.claim()[1]["idle_remaining_seconds"], 600)
        self.clock.return_value = 11200
        self.assertTrue(self.claim()[1]["claimed"])

    def test_second_claim_is_refused_until_released(self):
        first = self.claim()[1]
        second = self.claim()[1]
        self.assertEqual((second["claimed"], second["reason"]), (False, "claimed"))
        status, result = self.run_json(ovctl.cmd_stop_release, "not-the-token")
        self.assertEqual((status, result["released"], result["reason"]), (1, False, "token_mismatch"))
        self.assertTrue(self.claim()[1]["claimed"] is False)
        status, result = self.run_json(ovctl.cmd_stop_release, first["token"])
        self.assertEqual((status, result), (0, {"released": True}))
        self.assertTrue(self.claim()[1]["claimed"])

    def test_release_without_a_claim_is_idempotent(self):
        self.assertEqual(self.run_json(ovctl.cmd_stop_release, "anything"), (0, {"released": True}))

    def test_worker_refuses_to_start_indexing_under_a_live_claim(self):
        token = self.claim()[1]["token"]
        # Work enqueued after the claim stays durable and untouched.
        ovctl.enqueue_resource(self.source, self.uri)
        client = Mock()
        with patch.object(ovctl, "client", return_value=client) as make_client, patch.object(ovctl, "add_resource", return_value=True) as add:
            status, result = self.run_json(ovctl.cmd_resume_pending)
            self.assertEqual((status, result), (0, {"deferred": True, "reason": "stop_claimed", "pending": 1}))
            add.assert_not_called()
            make_client.assert_not_called()
            self.assertIn(self.uri, self.state())
            self.assertFalse((self.root / "index-completed.json").exists())
            # An aborted stop releases the claim and the next timer replays.
            self.run_json(ovctl.cmd_stop_release, token)
            self.assertEqual(ovctl.cmd_resume_pending(), 0)
            add.assert_called_once()
        self.assertEqual(self.state(), {})

    def test_synchronous_add_reports_pending_under_a_claim(self):
        self.claim()
        with patch.object(ovctl, "client", return_value=Mock()), patch.object(ovctl, "add_resource", return_value=True):
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(ovctl.cmd_add_resource(str(self.source), self.uri, wait=True), 1)
        self.assertEqual(json.loads(output.getvalue().splitlines()[-1]), {"ok": False, "uri": self.uri, "pending": True})
        self.assertIn(self.uri, self.state())

    def test_claim_is_refused_while_a_worker_is_indexing(self):
        ovctl.enqueue_resource(self.source, self.uri)
        observed = {}

        def index(*args, **kwargs):
            observed["claim"] = self.claim()[1]
            return True

        with patch.object(ovctl, "client", return_value=Mock()), patch.object(ovctl, "add_resource", side_effect=index):
            self.assertEqual(ovctl.cmd_resume_pending(), 0)
        self.assertEqual(observed["claim"], {"claimed": False, "reason": "busy"})
        self.assertFalse((self.root / "stop-claim.json").exists())
        # After the index the grace window applies before any claim.
        self.assertEqual(self.claim()[1]["reason"], "grace")

    def test_claim_is_refused_while_forget_holds_the_worker_lock(self):
        with (self.root / "pending-worker.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            self.assertEqual(self.claim()[1], {"claimed": False, "reason": "busy"})

    def test_claim_from_an_earlier_boot_is_void(self):
        self.claim()
        (self.root / "boot_id").write_text("boot-2\n")
        self.assertFalse(self.run_json(ovctl.cmd_idle_check, 1200)[1]["stop_claimed"])
        ovctl.enqueue_resource(self.source, self.uri)
        with patch.object(ovctl, "client", return_value=Mock()), patch.object(ovctl, "add_resource", return_value=True) as add:
            self.assertEqual(ovctl.cmd_resume_pending(), 0)
        add.assert_called_once()

    def test_expired_claim_is_void(self):
        self.claim(ttl=900)
        self.clock.return_value = 10900
        self.assertFalse(self.run_json(ovctl.cmd_idle_check, 1200)[1]["stop_claimed"])
        self.assertTrue(self.claim()[1]["claimed"])

    def test_corrupt_claim_cannot_grant_a_stop(self):
        for value in ("{broken", '{"token": 1}', '{"token": "t", "expires_at": true, "boot_id": "boot-1"}'):
            (self.root / "stop-claim.json").write_text(value)
            with self.assertRaises(ValueError):
                self.claim()
            with self.assertRaises(ValueError):
                self.run_json(ovctl.cmd_idle_check, 1200)

    def test_cli_wires_claim_and_release(self):
        with patch.object(ovctl.sys, "argv", ["ovctl", "stop-claim", "--grace-seconds", "1", "--ttl-seconds", "5"]):
            status, result = self.run_json(ovctl.main)
        self.assertEqual((status, result["claimed"], result["expires_at"]), (0, True, 10005))
        with patch.object(ovctl.sys, "argv", ["ovctl", "stop-release", "--token", result["token"]]):
            self.assertEqual(self.run_json(ovctl.main), (0, {"released": True}))


if __name__ == "__main__":
    unittest.main()
