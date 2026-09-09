#!/usr/bin/env python3
"""livecheck — exercise the real OpenViking server under the real systemd
units on an isolated Linux box (continue.md item 4, MEM-21/MEM-26/MEM-10).

Runs as the box user (`user`) with passwordless sudo, against the pinned
server started by openviking.service. Every scenario records only metadata
(counts, statuses, seconds, bytes) so the report is safe to publish as a CI
artifact. The synthetic corpus it writes lives under ~/.hermes/context and
is removed by the `clear` scenario.

    /home/user/.openviking-venv/bin/python livecheck.py --report REPORT.json

Exit status is 0 only when every scenario passed. This is evidence for an
isolated Linux/systemd host; it does not prove provider (ascii.dev) stop /
resume transitions, which need a real Box.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import random
import shlex
import subprocess
import sys
import time
import urllib.request

HOME = pathlib.Path.home()
OV_DIR = HOME / ".openviking"
URL = "http://127.0.0.1:1933"
THREAD = "a" * 64
THREAD_DIR = HOME / ".hermes" / "context" / "imessage-history" / "threads" / THREAD
THREAD_URI = f"viking://resources/context/imessage-history/threads/{THREAD}"
RESOURCES_ROOT = "viking://resources/context"
USER_MD = HOME / ".hermes" / "memories" / "USER.md"
CAS_CONFLICT_EXIT = 3
WORDS = ("alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo "
         "lima mike november oscar papa quebec romeo sierra tango").split()


class Check:
    def __init__(self) -> None:
        self.scenarios: list[dict] = []
        self.current: dict | None = None

    def begin(self, name: str) -> None:
        self.current = {"name": name, "ok": True, "started_at": time.time(), "notes": []}
        self.scenarios.append(self.current)

    def expect(self, condition: bool, note: str, **meta) -> None:
        assert self.current is not None
        entry = {"ok": bool(condition), "note": note, **meta}
        self.current["notes"].append(entry)
        if not condition:
            self.current["ok"] = False

    def end(self) -> None:
        assert self.current is not None
        self.current["seconds"] = round(time.time() - self.current["started_at"], 1)
        self.current = None


def run(*argv: str, check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(list(argv), capture_output=True, text=True, check=check)


def ovctl(*args: str) -> tuple[int, dict | None]:
    proc = run("ovctl", *args)
    try:
        payload = json.loads(proc.stdout.strip().splitlines()[-1]) if proc.stdout.strip() else None
    except (ValueError, IndexError):
        payload = None
    return proc.returncode, payload


def unit(name: str, *props: str) -> dict[str, str]:
    out = run("systemctl", "show", name, *(f"-p{p}" for p in props)).stdout
    return dict(line.split("=", 1) for line in out.splitlines() if "=" in line)


def health() -> dict | None:
    try:
        with urllib.request.urlopen(URL + "/health", timeout=5) as res:
            return json.loads(res.read())
    except Exception:
        return None


def pending_count() -> int:
    try:
        return len(json.loads((OV_DIR / "pending.json").read_text()))
    except FileNotFoundError:
        return 0


def receipt() -> float:
    try:
        return json.loads((OV_DIR / "index-completed.json").read_text())["completed_at"]
    except FileNotFoundError:
        return 0.0


def write_doc(name: str, lines: int, seed: int) -> tuple[pathlib.Path, int]:
    random.seed(seed)
    THREAD_DIR.mkdir(parents=True, exist_ok=True)
    path = THREAD_DIR / name
    with path.open("w") as out:
        out.write(f"# Synthetic thread {name}\n")
        for i in range(lines):
            who = random.choice(("alice", "bob"))
            body = " ".join(random.choice(WORDS) for _ in range(12))
            out.write(f"- [2024-01-{(i % 28) + 1:02d} {i % 24:02d}:{i % 60:02d}] {who}: {body} msg{i}\n")
    return path, path.stat().st_size


def sdk_client():
    from openviking_sdk import SyncHTTPClient

    c = SyncHTTPClient(url=URL, timeout=60)
    c.initialize()
    return c


def find_hits(query: str, target: str) -> int:
    """Resource hits for a query; -1 when the target itself cannot be searched."""
    c = sdk_client()
    try:
        result = c.find(query, target_uri=target, limit=10)
    except Exception:
        return -1
    finally:
        c.close()
    return len(result.get("resources") or [])


def classify_hits(query: str, target: str) -> list[dict]:
    """Per hit: URI, whether it still resolves (stat), and whether it is a
    directory abstract rather than content — metadata only."""
    c = sdk_client()
    try:
        hits = c.find(query, target_uri=target, limit=10).get("resources") or []
        out = []
        for hit in hits:
            uri = hit.get("uri", "")
            try:
                c.stat(uri)
                readable = True
            except Exception:
                readable = False
            out.append({"uri": uri, "readable": readable, "abstract": uri.endswith("/.abstract.md")})
        return out
    except Exception:
        return [{"uri": None, "readable": False, "abstract": False, "error": True}]
    finally:
        c.close()


def uri_exists(uri: str) -> bool:
    c = sdk_client()
    try:
        c.ls(uri)
        return True
    except Exception:
        return False
    finally:
        c.close()


def wait_for(predicate, timeout: float, interval: float = 2.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return predicate()


def worker_pid() -> int | None:
    out = run("pgrep", "-u", os.environ.get("USER", "user"), "-f", "ovctl.py resume-pending").stdout.split()
    return int(out[0]) if out else None


def server_rss_kib() -> int:
    pid = unit("openviking.service", "MainPID").get("MainPID", "0")
    if pid in ("", "0"):
        return 0
    out = run("ps", "-o", "rss=", "-p", pid).stdout.strip()
    return int(out) if out else 0


def scenario_units(ck: Check) -> None:
    ck.begin("units_and_health")
    ck.expect(wait_for(lambda: health() is not None, 240), "openviking.service serves /health within 240s")
    h = health() or {}
    ck.expect(h.get("healthy") is True, "health.healthy", version=h.get("version"), auth_mode=h.get("auth_mode"))
    ck.expect(h.get("version") == "0.4.16", "pinned server version 0.4.16", version=h.get("version"))
    svc = unit("openviking.service", "ActiveState", "SubState", "Restart", "NRestarts")
    ck.expect(svc.get("ActiveState") == "active", "openviking.service active", **svc)
    tmr = unit("openviking-index.timer", "ActiveState", "NextElapseUSecMonotonic")
    ck.expect(tmr.get("ActiveState") == "active", "openviking-index.timer active", **tmr)
    idx = unit("openviking-index.service", "Type", "TimeoutStartUSec")
    ck.expect(idx.get("Type") == "oneshot", "openviking-index.service is oneshot", **idx)
    code, status = ovctl("status")
    ck.expect(code == 0 and status is not None and status.get("healthy") is True, "ovctl status healthy", status=status)
    ck.end()


def scenario_sync_index(ck: Check) -> None:
    ck.begin("synchronous_index_and_search")
    path, size = write_doc("2024-01.md", 400, seed=1)
    t0 = time.time()
    code, out = ovctl("add-resource", str(path), "--to", f"{THREAD_URI}/2024-01")
    # A synchronous add is silent on success; it only prints {ok:false,pending:true}.
    ck.expect(code == 0 and out is None, "add-resource (wait) acknowledged",
              exit=code, bytes=size, seconds=round(time.time() - t0, 1))
    ck.expect(pending_count() == 0, "queue empty after synchronous add", pending=pending_count())
    hits = find_hits("alpha bravo charlie", f"{THREAD_URI}/2024-01")
    ck.expect(hits > 0, "semantic find returns hits under the indexed URI", hits=hits)
    ck.end()


def scenario_queued_replay(ck: Check) -> None:
    ck.begin("queued_index_timer_replay")
    path, size = write_doc("2024-02.md", 400, seed=2)
    code, out = ovctl("add-resource", str(path), "--to", f"{THREAD_URI}/2024-02", "--no-wait")
    ck.expect(code == 0 and out is not None and out.get("pending") is True, "add-resource --no-wait enqueued", exit=code, bytes=size)
    code, idle = ovctl("idle-check")
    ck.expect(code == 0 and idle is not None and idle.get("can_stop") is False and idle.get("pending") == 1,
              "idle-check refuses stop while work is pending", idle=idle)
    t0 = time.time()
    done = wait_for(lambda: pending_count() == 0, 600, 3)
    ck.expect(done, "timer replayed the queue", seconds=round(time.time() - t0, 1))
    hits = find_hits("delta echo foxtrot", f"{THREAD_URI}/2024-02")
    ck.expect(hits > 0, "replayed resource is searchable", hits=hits)
    ck.end()


def scenario_interrupted_index(ck: Check, lines: int, settle: float) -> None:
    ck.begin("interrupted_index_recovery")
    path, size = write_doc("2024-03.md", lines, seed=3)
    receipt_before = receipt()
    code, out = ovctl("add-resource", str(path), "--to", f"{THREAD_URI}/2024-03", "--no-wait")
    ck.expect(code == 0 and out is not None and out.get("pending") is True, "large document enqueued", bytes=size)
    started = wait_for(lambda: worker_pid() is not None, 120, 1)
    ck.expect(started, "durable worker started (timer or ExecStartPost)")
    peak = 0
    t_end = time.time() + settle
    while time.time() < t_end and worker_pid() is not None:
        peak = max(peak, server_rss_kib())
        time.sleep(1)
    mid_flight = worker_pid() is not None and pending_count() == 1
    ck.expect(mid_flight, "worker still indexing when the server is killed", pending=pending_count(), peak_rss_kib=peak)
    run("sudo", "systemctl", "kill", "-s", "SIGKILL", "openviking.service")
    # The worker loses its HTTP connection and exits non-zero well before
    # RestartSec (5s) lets ExecStartPost start the unit again.
    wait_for(lambda: unit("openviking-index.service", "ActiveState").get("ActiveState") in ("failed", "inactive"), 4, 0.25)
    idx = unit("openviking-index.service", "ActiveState", "Result", "ExecMainStatus")
    ck.expect(idx.get("ActiveState") == "failed" and idx.get("Result") == "exit-code",
              "index worker failed instead of acknowledging", **idx)
    ck.expect(pending_count() == 1, "queue entry survived the SIGKILL", pending=pending_count())
    ck.expect(receipt() == receipt_before, "no idle receipt written for interrupted work")
    ck.expect(wait_for(lambda: health() is not None, 240), "Restart=always brought the server back")
    svc = unit("openviking.service", "NRestarts")
    ck.expect(int(svc.get("NRestarts", "0")) >= 1, "service restart counted", **svc)
    t0 = time.time()
    done = wait_for(lambda: pending_count() == 0, 900, 5)
    ck.expect(done, "timer replayed the interrupted document", seconds=round(time.time() - t0, 1))
    ck.expect(receipt() > receipt_before, "idle receipt advanced after successful replay")
    hits = find_hits("golf hotel india", f"{THREAD_URI}/2024-03")
    ck.expect(hits > 0, "replayed large document is searchable", hits=hits)
    code, status = ovctl("status")
    ck.expect(code == 0 and status is not None and status.get("healthy") is True, "status healthy after recovery", status=status)
    ck.end()


def scenario_stop_claim(ck: Check) -> None:
    ck.begin("stop_claim_coordination")
    code, res = ovctl("stop-claim", "--grace-seconds", "1200")
    ck.expect(code == 0 and res is not None and res.get("claimed") is False and res.get("reason") == "grace",
              "claim refused inside the grace window", result=res)
    code, res = ovctl("stop-claim", "--grace-seconds", "1", "--ttl-seconds", "600")
    token = (res or {}).get("token")
    ck.expect(code == 0 and res is not None and res.get("claimed") is True and isinstance(token, str),
              "claim granted once the grace window elapsed", claimed=(res or {}).get("claimed"))
    code, idle = ovctl("idle-check", "--grace-seconds", "1")
    ck.expect(idle is not None and idle.get("stop_claimed") is True, "idle-check reports the live claim", idle=idle)
    code, again = ovctl("stop-claim", "--grace-seconds", "1")
    ck.expect(again is not None and again.get("claimed") is False and again.get("reason") == "claimed",
              "second claimant is refused", result=again)
    path, size = write_doc("2024-04.md", 200, seed=4)
    code, out = ovctl("add-resource", str(path), "--to", f"{THREAD_URI}/2024-04", "--no-wait")
    ck.expect(code == 0 and (out or {}).get("pending") is True, "enqueue while claimed stays durable")
    code, deferred = ovctl("resume-pending")
    ck.expect(code == 0 and deferred is not None and deferred.get("deferred") is True and deferred.get("reason") == "stop_claimed",
              "worker defers instead of indexing under a live claim", result=deferred)
    time.sleep(20)
    ck.expect(pending_count() == 1, "timer replay also left the work pending", pending=pending_count())
    code, bad = ovctl("stop-release", "--token", "0" * 32)
    ck.expect(code == 1 and bad is not None and bad.get("reason") == "token_mismatch", "foreign token cannot release", result=bad)
    code, rel = ovctl("stop-release", "--token", token or "")
    ck.expect(code == 0 and rel is not None and rel.get("released") is True, "owner token releases the claim", result=rel)
    t0 = time.time()
    ck.expect(wait_for(lambda: pending_count() == 0, 600, 3), "released queue replays", seconds=round(time.time() - t0, 1))
    ck.end()


def scenario_stale_or_corrupt_state(ck: Check) -> None:
    ck.begin("stale_claim_and_corrupt_state")
    claim_path = OV_DIR / "stop-claim.json"
    claim_path.write_text(json.dumps({"token": "deadbeef", "boot_id": "00000000-0000-0000-0000-000000000000",
                                      "claimed_at": time.time(), "expires_at": time.time() + 600}))
    code, idle = ovctl("idle-check")
    ck.expect(code == 0 and idle is not None and idle.get("stop_claimed") is False,
              "claim from another boot is ignored", idle=idle)
    claim_path.unlink()
    pending_path = OV_DIR / "pending.json"
    original = pending_path.read_text() if pending_path.exists() else "{}"
    pending_path.write_text("{not json")
    code, idle = ovctl("idle-check")
    ck.expect(code != 0, "corrupt pending state fails closed (non-zero, no permission to stop)", exit=code, parsed=idle)
    code, claim = ovctl("stop-claim", "--grace-seconds", "1")
    ck.expect(code != 0, "corrupt pending state also refuses a claim", exit=code)
    pending_path.write_text(original)
    ck.end()


def scenario_rm_and_clear(ck: Check) -> None:
    ck.begin("rm_and_clear")
    if not uri_exists(f"{THREAD_URI}/2024-01"):  # standalone run: build the fixture
        path, _ = write_doc("2024-01.md", 400, seed=1)
        ovctl("add-resource", str(path), "--to", f"{THREAD_URI}/2024-01")
    ck.expect(uri_exists(f"{THREAD_URI}/2024-01"), "target present before rm")
    code, out = ovctl("rm", f"{THREAD_URI}/2024-01")
    ck.expect(code == 0 and out is not None and out.get("ok") is True and out.get("absent") is False, "rm removed the resource", result=out)
    ck.expect(not uri_exists(f"{THREAD_URI}/2024-01"), "target gone after rm")
    code, out = ovctl("rm", f"{THREAD_URI}/2024-01")
    # Server 0.4.16 deletes idempotently, so `absent` records whether the
    # typed NotFoundError path ever fires against the real server.
    ck.expect(code == 0 and out is not None and out.get("ok") is True,
              "rm of an absent URI succeeds", absent=out.get("absent") if out else None)
    path, _ = write_doc("2024-05.md", 100, seed=5)
    ovctl("add-resource", str(path), "--to", f"{THREAD_URI}/2024-05", "--no-wait")
    code, out = ovctl("rm", THREAD_URI)
    ck.expect(code == 0 and (out or {}).get("ok") is True, "rm of the thread root succeeded", result=out)
    ck.expect(pending_count() == 0, "queued descendant was cancelled by rm", pending=pending_count())
    time.sleep(20)
    ck.expect(not uri_exists(f"{THREAD_URI}/2024-05"), "timer did not resurrect the cancelled descendant")
    path, _ = write_doc("2024-06.md", 100, seed=6)
    code, out = ovctl("add-resource", str(path), "--to", f"{THREAD_URI}/2024-06")
    ck.expect(code == 0, "re-index after rm works")
    code, out = ovctl("clear", "--scope", "resources")
    ck.expect(code == 0 and out is not None and out.get("ok") is True and RESOURCES_ROOT in (out.get("removed") or []),
              "clear --scope resources removed the root", result=out)
    ck.expect(set((out or {}).keys()) <= {"ok", "scope", "removed", "absent", "resurrected", "failed", "errors"}, "clear output is metadata only")
    code, status = ovctl("status")
    ck.expect(status is not None and status.get("resources") == 0 and status.get("pending") == 0, "no resource leaves after clear", status=status)
    # The (waited) rm drops content chunks from find at once; dangling vectors
    # for the deleted directories' .abstract.md drain later. Record both.
    hits = classify_hits("alpha bravo charlie", RESOURCES_ROOT)
    ck.expect(not any(h["readable"] for h in hits), "no stale hit still resolves", hits=hits)
    ck.expect(not any(not h["abstract"] for h in hits), "no cleared content chunk surfaces in find", hits=len(hits))
    t0 = time.time()
    drained = wait_for(lambda: find_hits("alpha bravo charlie", RESOURCES_ROOT) <= 0, 120, 5)
    ck.expect(True, "dangling abstract vectors drain (informational)",
              drained_within_120s=drained, seconds=round(time.time() - t0, 1))
    code, out = ovctl("clear", "--scope", "resources")
    ck.expect(code == 0 and out is not None and out.get("ok") is True, "clear is idempotent", result=out)
    ck.end()


def cas_write(content: str, base_revision: str) -> int:
    """Mirror of apps/web/lib/memory/files.ts writeUserProfile (run over the
    box command API in production); the exit code is what the control plane
    maps to UserProfileConflictError."""
    rel = ".hermes/memories/USER.md"
    script = (
        f"mkdir -p .hermes/memories && f={shlex.quote(rel)} && "
        "cur=$( { [ -f \"$f\" ] && cat \"$f\" || printf ''; } | sha256sum | cut -d' ' -f1 ) && "
        f"{{ [ \"$cur\" = {shlex.quote(base_revision)} ] || exit {CAS_CONFLICT_EXIT}; }} && "
        f"printf '%s' {shlex.quote(content)} > \"$f.tmp.$$\" && mv -f \"$f.tmp.$$\" \"$f\""
    )
    return subprocess.run(["bash", "-c", script], cwd=HOME, capture_output=True).returncode


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def scenario_user_md_cas(ck: Check) -> None:
    ck.begin("user_md_compare_and_swap")
    USER_MD.parent.mkdir(parents=True, exist_ok=True)
    if USER_MD.exists():
        USER_MD.unlink()
    code = cas_write("owner v1", sha256(""))
    ck.expect(code == 0 and USER_MD.read_text() == "owner v1", "write against the empty-file revision succeeds", exit=code)
    USER_MD.write_text("agent rewrote this")
    code = cas_write("owner v2", sha256("owner v1"))
    ck.expect(code == CAS_CONFLICT_EXIT, "stale revision exits with the conflict status", exit=code)
    ck.expect(USER_MD.read_text() == "agent rewrote this", "stale write did not overwrite the agent's version")
    ck.expect(not list(USER_MD.parent.glob("USER.md.tmp.*")), "no temp file left behind")
    code = cas_write("owner v3", sha256("agent rewrote this"))
    ck.expect(code == 0 and USER_MD.read_text() == "owner v3", "fresh revision succeeds", exit=code)
    USER_MD.unlink()
    ck.end()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--large-lines", type=int, default=30000)
    parser.add_argument("--interrupt-after", type=float, default=15.0)
    parser.add_argument("--scenario", action="append", help="run only the named scenario(s)")
    args = parser.parse_args()

    ck = Check()
    scenarios = (
        ("units_and_health", scenario_units),
        ("synchronous_index_and_search", scenario_sync_index),
        ("queued_index_timer_replay", scenario_queued_replay),
        ("interrupted_index_recovery", lambda c: scenario_interrupted_index(c, args.large_lines, args.interrupt_after)),
        ("stop_claim_coordination", scenario_stop_claim),
        ("stale_claim_and_corrupt_state", scenario_stale_or_corrupt_state),
        ("rm_and_clear", scenario_rm_and_clear),
        ("user_md_compare_and_swap", scenario_user_md_cas),
    )
    for name, scenario in scenarios:
        if args.scenario and name not in args.scenario:
            continue
        try:
            scenario(ck)
        except Exception as error:  # a crashed scenario is a failure, not a skip
            if ck.current is None:
                ck.begin("crashed")
            ck.expect(False, f"scenario raised {type(error).__name__}")
            ck.end()

    systemd_version = run("systemctl", "--version").stdout.splitlines()
    report = {
        "host": "isolated-linux-systemd",
        "kernel": os.uname().release,
        "systemd": systemd_version[0] if systemd_version else None,
        "server_version": (health() or {}).get("version"),
        "passed": sum(1 for s in ck.scenarios if s["ok"]),
        "total": len(ck.scenarios),
        "scenarios": ck.scenarios,
    }
    pathlib.Path(args.report).write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "scenarios"}))
    for s in ck.scenarios:
        print(f"{'PASS' if s['ok'] else 'FAIL'} {s['name']} ({s['seconds']}s)")
        for n in s["notes"]:
            if not n["ok"]:
                print(f"  - {n}")
    return 0 if report["passed"] == report["total"] else 1


if __name__ == "__main__":
    sys.exit(main())
