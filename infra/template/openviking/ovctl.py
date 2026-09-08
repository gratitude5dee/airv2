#!/usr/bin/env python3
"""ovctl — box-side OpenViking control (docs/memory-upgrade.md, layer 2).

Runs INSIDE the user's box against the loopback-only OpenViking server. The
control plane invokes it over the box command API; the agent never calls it
(the agent reaches OpenViking through the MCP tools). Every subcommand except
`export` and `recent` prints only metadata — counts, URIs, statuses — so that
stdout is safe to relay through control-plane logs (C4). `export` and `recent`
print memory TEXT and must be treated as content by their callers (box →
response only, never logged or persisted).

Subcommands:
  ensure                       render ov.conf from ~/.hermes/.env, (re)start
                               the service when the conf changed, wait healthy
  ensure --configure-only      render config only (safe inside ExecStartPre)
  status                       JSON: {healthy, resources, memories,
                               workspace_bytes, pending, truncated} — leaf
                               (file) counts, directories excluded
  add-resource PATH --to URI   idempotent: replaces URI if it already exists
  rm URI                       recursive remove, tolerates absence
  clear --scope SCOPE          owner wipe: resources (viking://resources/context),
                               memories (viking://user) or all
  idle-check                   JSON: {can_stop, pending, idle_remaining_seconds}
  stop-claim                   atomically claim an idle stop; the durable
                               worker refuses to start indexing while a
                               claim from this boot is live
  stop-release --token TOKEN   release an aborted stop claim
  reindex                      re-add the onboarding context dirs/files
  export                       JSON inventory: resource/memory URIs + memory
                               contents (bounded), for /api/admin/export
"""

import argparse
import contextlib
import datetime
import fcntl
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import uuid

HOME = pathlib.Path.home()
ENV_FILE = HOME / ".hermes" / ".env"
OV_DIR = HOME / ".openviking"
CONF = OV_DIR / "ov.conf"
URL = "http://127.0.0.1:1933"

IMESSAGE_DIR = HOME / ".hermes" / "context" / "imessage-history"
ONAIROS_MD = HOME / ".hermes" / "context" / "onairos.md"
IMPORT_DIR = HOME / ".hermes" / "context" / "agent-import"
DICTIONARY_MD = HOME / ".hermes" / "context" / "Dictionary.MD"
IMESSAGE_URI = "viking://resources/context/imessage-history"
ONAIROS_URI = "viking://resources/context/onairos"
IMPORT_URI = "viking://resources/context/agent-import"
DICTIONARY_URI = "viking://resources/context/dictionary"
RESOURCES_ROOT = "viking://resources/context"
MEMORIES_ROOT = "viking://user"
CLEAR_SCOPES = {
    "resources": (RESOURCES_ROOT,),
    "memories": (MEMORIES_ROOT,),
    "all": (RESOURCES_ROOT, MEMORIES_ROOT),
}
INDEX_WAIT_SECONDS = 600
INDEX_HTTP_TIMEOUT_SECONDS = INDEX_WAIT_SECONDS + 60
CLEAR_SETTLE_SECONDS = 30
STOP_CLAIM_FILE = "stop-claim.json"
STOP_CLAIM_TTL_SECONDS = 900
BOOT_ID_FILE = pathlib.Path("/proc/sys/kernel/random/boot_id")


def not_found_error():
    """The pinned SDK's typed 'nothing at this URI' failure (server code NOT_FOUND)."""
    from openviking_sdk.errors import NotFoundError

    return NotFoundError


def resource_absent(error: Exception) -> bool:
    return isinstance(error, not_found_error())


def boot_id() -> str:
    try:
        return BOOT_ID_FILE.read_text().strip()
    except OSError:
        return ""


def read_stop_claim() -> dict | None:
    """Live claim from this boot, or None. Call under the pending lock.

    A claim survives in the snapshot of a box that was stopped, so a claim
    from an earlier boot is void; a sweeper that died mid-stop is bounded by
    the claim's TTL.
    """
    try:
        claim = json.loads((OV_DIR / STOP_CLAIM_FILE).read_text())
    except FileNotFoundError:
        return None
    if (
        not isinstance(claim, dict)
        or not isinstance(claim.get("token"), str)
        or not isinstance(claim.get("expires_at"), (int, float))
        or isinstance(claim.get("expires_at"), bool)
        or not isinstance(claim.get("boot_id"), str)
    ):
        raise ValueError("invalid stop claim")
    if claim["boot_id"] != boot_id() or claim["expires_at"] <= time.time():
        return None
    return claim


def write_stop_claim(claim: dict) -> None:
    fd, temporary = tempfile.mkstemp(prefix=".stop-claim-", dir=OV_DIR)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump(claim, output)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, OV_DIR / STOP_CLAIM_FILE)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def idle_state(state: dict, grace_seconds: int) -> dict:
    """Queue emptiness plus the post-index grace window. Call under the pending lock."""
    pending = len(state)
    try:
        receipt = json.loads((OV_DIR / "index-completed.json").read_text())
        completed = receipt["completed_at"]
        if not isinstance(completed, (int, float)) or isinstance(completed, bool) or not 0 <= completed < float("inf"):
            raise ValueError("invalid index completion time")
    except FileNotFoundError:
        completed = 0
    remaining = max(0, completed + grace_seconds - time.time())
    return {"can_stop": pending == 0 and remaining == 0,
            "pending": pending, "idle_remaining_seconds": remaining}


def write_idle_receipt() -> None:
    """Commit the idle-window origin before acknowledging the final index."""
    fd, temporary = tempfile.mkstemp(prefix=".index-complete-", dir=OV_DIR)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump({"completed_at": time.time()}, output)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, OV_DIR / "index-completed.json")
        directory = os.open(OV_DIR, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def cmd_idle_check(grace_seconds: int) -> int:
    # Read under the enqueue lock. Unknown/corrupt state raises instead of
    # granting permission to stop. The caller must also handle command errors.
    with pending_state() as state:
        result = idle_state(state, grace_seconds)
        result["stop_claimed"] = read_stop_claim() is not None
    print(json.dumps(result))
    return 0


def cmd_stop_claim(grace_seconds: int, ttl_seconds: int) -> int:
    """Claim the idle stop or explain why not; exit 0 either way.

    Holding the worker lock excludes an in-flight index; holding the pending
    lock makes the emptiness check and the claim write one atomic step, so a
    worker that starts afterwards observes the claim before it can index.
    """
    OV_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (OV_DIR / "pending-worker.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({"claimed": False, "reason": "busy"}))
            return 0
        with pending_state() as state:
            result = idle_state(state, grace_seconds)
            if read_stop_claim() is not None:
                result.update({"claimed": False, "reason": "claimed"})
            elif result["pending"]:
                result.update({"claimed": False, "reason": "pending"})
            elif result["idle_remaining_seconds"]:
                result.update({"claimed": False, "reason": "grace"})
            else:
                claim = {"token": uuid.uuid4().hex, "boot_id": boot_id(),
                         "claimed_at": time.time(), "expires_at": time.time() + ttl_seconds}
                write_stop_claim(claim)
                result.update({"claimed": True, "token": claim["token"],
                               "expires_at": claim["expires_at"]})
    print(json.dumps(result))
    return 0


def cmd_stop_release(token: str) -> int:
    with pending_state():
        claim = read_stop_claim()
        if claim is not None and claim["token"] != token:
            print(json.dumps({"released": False, "reason": "token_mismatch"}))
            return 1
        with contextlib.suppress(FileNotFoundError):
            (OV_DIR / STOP_CLAIM_FILE).unlink()
    print(json.dumps({"released": True}))
    return 0


@contextlib.contextmanager
def pending_state():
    """Serialize durable queue updates; never hold this lock during indexing."""
    OV_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (OV_DIR / "pending.lock").open("a") as lock:
        os.chmod(lock.name, 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = OV_DIR / "pending.json"
        try:
            state = json.loads(path.read_text())
        except FileNotFoundError:
            state = {}
        if not isinstance(state, dict) or any(
            not isinstance(uri, str) or not isinstance(entry, dict)
            or not isinstance(entry.get("path"), str)
            or not isinstance(entry.get("generation"), str)
            for uri, entry in state.items()
        ):
            raise ValueError("invalid pending index state")
        yield state
        fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=OV_DIR)
        try:
            with os.fdopen(fd, "w") as output:
                json.dump(state, output)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, path)
            directory = os.open(OV_DIR, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)


def enqueue_resource(path: pathlib.Path, uri: str) -> None:
    with pending_state() as state:
        state[uri] = {"path": str(path), "generation": uuid.uuid4().hex}


def cmd_resume_pending(block: bool = False) -> int:
    """Replay interrupted work; remove a receipt only after synchronous success.

    A separate worker lock permits concurrent enqueues while preventing two
    workers from replacing the same resource underneath one another. The
    timer yields to a running worker; a synchronous add waits for it.
    """
    OV_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (OV_DIR / "pending-worker.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | (0 if block else fcntl.LOCK_NB))
        except BlockingIOError:
            return 0
        with pending_state() as state:
            snapshot = dict(state)
            claimed = read_stop_claim() is not None
        if not snapshot:
            return 0
        if claimed:
            # Enqueued work stays durable; the next boot's timer replays it.
            print(json.dumps({"deferred": True, "reason": "stop_claimed", "pending": len(snapshot)}))
            return 0
        c = client(timeout=INDEX_HTTP_TIMEOUT_SECONDS)
        failed = False
        try:
            for uri, entry in snapshot.items():
                try:
                    if not add_resource(c, pathlib.Path(entry["path"]), uri, wait=True):
                        failed = True
                        continue
                except Exception as error:
                    # Journal gets the error class only, never the document.
                    print(json.dumps({"failed": uri, "error": type(error).__name__}), file=sys.stderr)
                    failed = True
                    continue
                with pending_state() as state:
                    if state.get(uri) == entry:
                        # Publish this first: a crash may extend the idle
                        # window, but cannot clear work without its grace.
                        write_idle_receipt()
                        del state[uri]
        finally:
            c.close()
        return 1 if failed else 0


def env_value(key: str) -> str:
    """Read one key from ~/.hermes/.env without sourcing it (values may
    contain shell metacharacters — same rule as the air-vault wrapper)."""
    try:
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith(key + "="):
                return line[len(key) + 1 :].strip()
    except OSError:
        pass
    return ""


def render_conf() -> dict:
    """Local-only server: loopback bind, local AGFS + vector store, built-in
    local dense embeddings (no embedding block = default local model). The
    VLM (summaries / memory extraction) routes through the inference gateway
    — the only holder of provider keys — when the per-fork token exists."""
    conf = {
        "storage": {
            "workspace": str(OV_DIR / "data"),
            "agfs": {"backend": "local"},
            "vectordb": {"backend": "local"},
        },
        "server": {"host": "127.0.0.1", "port": 1933, "auth_mode": "dev"},
        "log": {"level": "warning"},
    }
    base = env_value("OPENAI_BASE_URL")
    key = env_value("OPENAI_API_KEY")
    if base and key and "PLACEHOLDER" not in key:
        vlm = {
            "provider": "openai",
            "model": "balanced",
            "api_base": base,
            "api_key": key,
            "temperature": 0,
        }
        conf["vlm"] = vlm
    return conf


def write_conf() -> bool:
    OV_DIR.mkdir(mode=0o700, exist_ok=True)
    desired = json.dumps(render_conf(), indent=2, sort_keys=True)
    current = CONF.read_text() if CONF.exists() else None
    changed = current != desired
    if changed:
        fd, temporary = tempfile.mkstemp(prefix=".ov-conf-", dir=OV_DIR)
        try:
            with os.fdopen(fd, "w") as output:
                output.write(desired)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, CONF)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    CONF.chmod(0o600)
    return changed


def cmd_ensure(configure_only: bool = False) -> int:
    changed = write_conf()
    if configure_only:
        # ExecStartPre must not restart its own unit or wait for that unit.
        print(json.dumps({"ok": True, "conf_changed": changed}))
        return 0
    if changed or not healthy():
        subprocess.run(
            ["sudo", "systemctl", "restart", "openviking.service"], check=False
        )
    import time

    for _ in range(60):
        if healthy():
            print(json.dumps({"ok": True, "conf_changed": changed}))
            return 0
        time.sleep(2)
    print(json.dumps({"ok": False, "error": "openviking not healthy"}))
    return 1


def healthy() -> bool:
    import urllib.request

    try:
        with urllib.request.urlopen(URL + "/health", timeout=5) as res:
            return res.status == 200
    except Exception:
        return False


def client(timeout: float = 60):
    from openviking_sdk import SyncHTTPClient

    c = SyncHTTPClient(url=URL, timeout=timeout)
    c.initialize()
    return c


# Bounds one directory listing and one whole walk; the server's own `tree`
# stops at three levels, which hides per-month archive documents.
LS_PAGE_LIMIT = 1000
WALK_NODE_LIMIT = 20000


def walk_entries(c, root: str, limit: int = WALK_NODE_LIMIT) -> tuple:
    """Breadth-first `ls` walk yielding (entries, truncated). Entries are the
    server's original-format dicts ({uri, isDir, modTime, ...}); an absent
    root lists as empty. Hidden files stay hidden (no .abstract/.overview)."""
    if not isinstance(root, str) or not root.startswith("viking://"):
        raise ValueError("invalid viking uri")
    entries: list = []
    truncated = False
    queue = [root]
    while queue:
        directory = queue.pop(0)
        try:
            listed = c.ls(directory, output="original", node_limit=LS_PAGE_LIMIT)
        except Exception as error:
            if directory == root and resource_absent(error):
                return [], False
            raise
        if not isinstance(listed, list):
            raise ValueError("invalid listing")
        if len(listed) >= LS_PAGE_LIMIT:
            truncated = True
        for entry in listed:
            if not isinstance(entry, dict) or not isinstance(entry.get("uri"), str):
                continue
            if len(entries) >= limit:
                return entries, True
            entries.append(entry)
            if entry.get("isDir") is True:
                queue.append(entry["uri"])
    return entries, truncated


def leaf_entries(entries: list) -> list:
    return [entry for entry in entries if entry.get("isDir") is not True]


def list_uris(c, root: str) -> list:
    """Flat URI listing under a root (directories included); tolerate an
    unreadable tree."""
    try:
        entries, _ = walk_entries(c, root)
    except Exception:
        return []
    return [entry["uri"] for entry in entries]


def cmd_status() -> int:
    ok = healthy()
    with pending_state() as state:
        pending = len(state)
    resources = 0
    memories = 0
    truncated = False
    if ok:
        try:
            c = client()
            try:
                context, context_truncated = walk_entries(c, "viking://resources/context")
                user, user_truncated = walk_entries(c, "viking://user")
            finally:
                c.close()
            resources = len(leaf_entries(context))
            memories = len(leaf_entries(user))
            truncated = context_truncated or user_truncated
        except Exception:
            ok = False
    workspace_bytes = 0
    data = OV_DIR / "data"
    if data.exists():
        workspace_bytes = sum(
            f.stat().st_size for f in data.rglob("*") if f.is_file()
        )
    print(
        json.dumps(
            {"healthy": ok, "resources": resources, "memories": memories,
             "workspace_bytes": workspace_bytes, "pending": pending,
             "truncated": truncated}
        )
    )
    return 0


def add_resource(c, path: pathlib.Path, to: str, wait: bool = True) -> bool:
    if not path.exists():
        return False
    try:
        c.rm(to, recursive=True, wait=True)
    except Exception as error:
        # Only "nothing to replace" is harmless; a failed removal must not be
        # papered over by adding on top of stale content.
        if not resource_absent(error):
            raise
    result = c.add_resource(str(path), to=to, wait=wait, timeout=INDEX_WAIT_SECONDS, strict=True)
    # The pinned SDK returns the result body, including non-exception error
    # and cancellation outcomes. Only a completed resource receipt can
    # acknowledge durable work; an empty/unrecognized result stays pending.
    if not isinstance(result, dict) or result.get("status") in (
        "error", "cancelled", "canceled", "failed", "pending", "processing", "queued"
    ):
        return False
    if result.get("errors") or not isinstance(result.get("root_uri"), str) or not result["root_uri"]:
        return False
    if wait and result.get("task_id"):
        return False
    queues = result.get("queue_status", {})
    if not isinstance(queues, dict):
        return False
    for group in queues.values():
        if not isinstance(group, dict) or group.get("errors") or group.get("error_count", 0) != 0:
            return False
    return True


def cmd_add_resource(path: str, to: str, wait: bool) -> int:
    p = pathlib.Path(path).expanduser()
    if not p.is_absolute():
        p = HOME / p
    if not p.exists():
        print(json.dumps({"ok": False, "uri": to}))
        return 1
    enqueue_resource(p, to)
    if not wait:
        print(json.dumps({"ok": True, "uri": to, "pending": True}))
        return 0
    status = cmd_resume_pending(block=True)
    with pending_state() as state:
        if to in state:
            print(json.dumps({"ok": False, "uri": to, "pending": True}))
            return 1
    return status


def cmd_rm(uri: str) -> int:
    # Exclude an in-flight replay and cancel queued descendants before
    # forgetting, so the next timer cannot restore disconnected context.
    OV_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (OV_DIR / "pending-worker.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with pending_state() as state:
            for queued in list(state):
                if queued == uri or queued.startswith(uri.rstrip("/") + "/"):
                    del state[queued]
        c = client()
        absent = False
        try:
            c.rm(uri, recursive=True, wait=True)
        except Exception as error:
            if not resource_absent(error):
                print(json.dumps({"ok": False, "uri": uri, "error": type(error).__name__}))
                return 1
            absent = True
        finally:
            c.close()
    print(json.dumps({"ok": True, "uri": uri, "absent": absent}))
    return 0


def under_root(uri: str, root: str) -> bool:
    return uri == root or uri.startswith(root.rstrip("/") + "/")


def cmd_clear(scope: str) -> int:
    """Owner-initiated wipe of whole roots. Same exclusion as `rm`: hold the
    worker lock so no replay is mid-flight, cancel queued work under the
    cleared roots before removing, so the durable timer cannot restore what
    the owner just cleared. Output is metadata only (roots, never content).

    The server's semantic processor refreshes a parent directory's abstract
    when children change; a refresh racing the delete can re-create a cleared
    root holding a derived summary. After the server settles, any root that
    resolves again is removed a second time and reported as `resurrected`."""
    roots = CLEAR_SCOPES[scope]
    OV_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (OV_DIR / "pending-worker.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with pending_state() as state:
            for queued in list(state):
                if any(under_root(queued, root) for root in roots):
                    del state[queued]
        c = client()
        removed, absent, failed, errors = [], [], [], []
        try:
            for root in roots:
                try:
                    c.rm(root, recursive=True, wait=True)
                except Exception as error:
                    if resource_absent(error):
                        absent.append(root)
                    else:
                        failed.append(root)
                        errors.append(type(error).__name__)
                    continue
                removed.append(root)
            resurrected = []
            for root in resurrected_roots(c, removed):
                try:
                    c.rm(root, recursive=True, wait=True)
                except Exception as error:
                    if not resource_absent(error):
                        failed.append(root)
                        errors.append(type(error).__name__)
                    continue
                resurrected.append(root)
        finally:
            c.close()
    if failed:
        print(json.dumps({"ok": False, "scope": scope, "failed": failed, "errors": errors}))
        return 1
    report = {"ok": True, "scope": scope, "removed": removed, "absent": absent}
    if resurrected:
        report["resurrected"] = resurrected
    print(json.dumps(report))
    return 0


def resurrected_roots(c, roots: list[str]) -> list[str]:
    """Roots that resolve again once the server's background processors settle."""
    try:
        c.wait_processed(timeout=CLEAR_SETTLE_SECONDS)
    except Exception:
        pass  # older server without the endpoint, or a slow settle: still re-check
    back = []
    for root in roots:
        try:
            c.ls(root)
        except Exception as error:
            if resource_absent(error):
                continue
        back.append(root)
    return back


def queue_existing(path: pathlib.Path, uri: str) -> bool:
    if not path.exists():
        return False
    enqueue_resource(path, uri)
    return True


def cmd_reindex() -> int:
    added = []
    legacy_pending = sum(1 for path in IMESSAGE_DIR.glob("chunk-*.json")
                         if re.fullmatch(r"chunk-[0-9]+\.json", path.name))
    # Match the uploader's per-thread/month resource identities. Never
    # recursively index status, staging files or old raw JSON chunks.
    threads = IMESSAGE_DIR / "threads"
    if threads.is_symlink():
        raise RuntimeError("archive threads directory is a symlink")
    if threads.exists():
        for thread in sorted(threads.iterdir()):
            if not re.fullmatch(r"[a-f0-9]{64}", thread.name):
                continue
            if thread.is_symlink() or not thread.is_dir():
                raise RuntimeError("invalid archive thread directory")
            for document in sorted(thread.iterdir()):
                if not re.fullmatch(r"[0-9]{4}-(0[1-9]|1[0-2])\.md", document.name):
                    continue
                if document.is_symlink() or not document.is_file():
                    raise RuntimeError("invalid archive document")
                uri = f"{IMESSAGE_URI}/threads/{thread.name}/{document.stem}"
                if queue_existing(document, uri):
                    added.append(uri)
    if queue_existing(ONAIROS_MD, ONAIROS_URI):
        added.append(ONAIROS_URI)
    # Match each source's upload URI. Do not recursively import status
    # files or collapse sources into an overlapping root resource.
    for source in ("hermes", "codex", "claude"):
        uri = f"{IMPORT_URI}/{source}"
        if queue_existing(IMPORT_DIR / source, uri):
            added.append(uri)
    if queue_existing(DICTIONARY_MD, DICTIONARY_URI):
        added.append(DICTIONARY_URI)
    print(json.dumps({"ok": legacy_pending == 0, "added": added,
                      "legacy_migration_pending": legacy_pending}))
    return 0 if legacy_pending == 0 else 1


def cmd_export() -> int:
    """Inventory + memory contents for the admin export. Resource BODIES are
    already exported via the box snapshot (they are files under ~/.hermes and
    ~/.openviking); memories are OpenViking-derived, so their text rides
    along here. This output is content — the export route must treat it like
    the memory files (box → response only, never persisted)."""
    if not healthy():
        print(json.dumps({"error": "openviking not running"}))
        return 1
    c = client()
    try:
        resources = list_uris(c, "viking://resources")
        memory_uris = list_uris(c, "viking://user")
        memories = []
        for uri in memory_uris[:2000]:
            entry = {"uri": uri}
            try:
                entry["content"] = c.read(uri, limit=65536)
            except Exception:
                pass  # directory node or unreadable — inventory only
            memories.append(entry)
    finally:
        c.close()
    print(json.dumps({"resources": resources, "memories": memories}))
    return 0


def modified_at(entry: dict) -> float | None:
    stamp = entry.get("modTime")
    if not isinstance(stamp, str):
        return None
    try:
        return datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def recent_first(entries: list) -> list:
    """Newest first by the server's modTime; undated entries follow, and ties
    fall back to URI descending so the order is stable across calls."""
    dated = [entry for entry in entries if modified_at(entry) is not None]
    undated = [entry for entry in entries if modified_at(entry) is None]
    dated.sort(key=lambda entry: (-modified_at(entry), entry["uri"]))
    undated.sort(key=lambda entry: entry["uri"], reverse=True)
    return dated + undated


def cmd_recent(limit: int) -> int:
    """Bounded preview listing for the Persona view: the `limit` most recently
    modified memories with a 240-char content preview each, truncated box-
    side so the control plane never buffers the full store. Same content
    posture as export (box → response only, never persisted). Totals come
    from `status`; this list is a preview, not a count."""
    if not healthy():
        print(json.dumps({"error": "openviking not running"}))
        return 1
    limit = max(1, min(limit, 50))
    c = client()
    try:
        resources = list_uris(c, "viking://resources")
        entries, _ = walk_entries(c, "viking://user")
        memories = []
        for entry in recent_first(leaf_entries(entries)):
            try:
                content = c.read(entry["uri"], limit=1024)
            except Exception:
                continue  # unreadable
            if not content:
                continue
            memories.append({"uri": entry["uri"], "preview": content[:240]})
            if len(memories) >= limit:
                break
    finally:
        c.close()
    print(json.dumps({"resources": resources, "memories": memories}))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="ovctl")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_ensure = sub.add_parser("ensure")
    p_ensure.add_argument("--configure-only", action="store_true")
    sub.add_parser("status")
    sub.add_parser("resume-pending")
    p_idle = sub.add_parser("idle-check")
    p_idle.add_argument("--grace-seconds", type=int, default=1200)
    p_claim = sub.add_parser("stop-claim")
    p_claim.add_argument("--grace-seconds", type=int, default=1200)
    p_claim.add_argument("--ttl-seconds", type=int, default=STOP_CLAIM_TTL_SECONDS)
    p_release = sub.add_parser("stop-release")
    p_release.add_argument("--token", required=True)
    p_add = sub.add_parser("add-resource")
    p_add.add_argument("path")
    p_add.add_argument("--to", required=True)
    # Enqueue only: the durable worker indexes after ovctl exits. Latency-
    # sensitive callers (the upload path) use this so a slow index never
    # stalls an HTTP response.
    p_add.add_argument("--no-wait", action="store_true")
    p_rm = sub.add_parser("rm")
    p_rm.add_argument("uri")
    p_clear = sub.add_parser("clear")
    p_clear.add_argument("--scope", required=True, choices=sorted(CLEAR_SCOPES))
    sub.add_parser("reindex")
    sub.add_parser("export")
    p_recent = sub.add_parser("recent")
    p_recent.add_argument("--limit", type=int, default=12)
    args = parser.parse_args()
    if args.cmd == "ensure":
        return cmd_ensure(configure_only=args.configure_only)
    if args.cmd == "status":
        return cmd_status()
    if args.cmd == "resume-pending":
        return cmd_resume_pending()
    if args.cmd == "idle-check":
        if args.grace_seconds < 1:
            parser.error("grace-seconds must be positive")
        return cmd_idle_check(args.grace_seconds)
    if args.cmd == "stop-claim":
        if args.grace_seconds < 1 or args.ttl_seconds < 1:
            parser.error("grace-seconds and ttl-seconds must be positive")
        return cmd_stop_claim(args.grace_seconds, args.ttl_seconds)
    if args.cmd == "stop-release":
        return cmd_stop_release(args.token)
    if args.cmd == "add-resource":
        return cmd_add_resource(args.path, args.to, wait=not args.no_wait)
    if args.cmd == "rm":
        return cmd_rm(args.uri)
    if args.cmd == "clear":
        return cmd_clear(args.scope)
    if args.cmd == "reindex":
        return cmd_reindex()
    if args.cmd == "export":
        return cmd_export()
    if args.cmd == "recent":
        return cmd_recent(args.limit)
    return 2


if __name__ == "__main__":
    sys.exit(main())
