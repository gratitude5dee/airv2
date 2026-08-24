#!/usr/bin/env python3
"""ovctl — box-side OpenViking control (docs/memory-upgrade.md, layer 2).

Runs INSIDE the user's box against the loopback-only OpenViking server. The
control plane invokes it over the box command API; the agent never calls it
(the agent reaches OpenViking through the MCP tools). Everything it prints is
metadata — counts, URIs, statuses — never resource or memory content, so its
stdout is safe to relay through control-plane logs (C4).

Subcommands:
  ensure                       render ov.conf from ~/.hermes/.env, (re)start
                               the service when the conf changed, wait healthy
  status                       JSON: {healthy, resources, workspace_bytes}
  add-resource PATH --to URI   idempotent: replaces URI if it already exists
  rm URI                       recursive remove, tolerates absence
  reindex                      re-add the onboarding context dirs/files
  export                       JSON inventory: resource/memory URIs + memory
                               contents (bounded), for /api/admin/export
"""

import argparse
import json
import pathlib
import subprocess
import sys

HOME = pathlib.Path.home()
ENV_FILE = HOME / ".hermes" / ".env"
OV_DIR = HOME / ".openviking"
CONF = OV_DIR / "ov.conf"
URL = "http://127.0.0.1:1933"

IMESSAGE_DIR = HOME / ".hermes" / "context" / "imessage-history"
ONAIROS_MD = HOME / ".hermes" / "context" / "onairos.md"
IMESSAGE_URI = "viking://resources/context/imessage-history"
ONAIROS_URI = "viking://resources/context/onairos"


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


def cmd_ensure() -> int:
    OV_DIR.mkdir(mode=0o700, exist_ok=True)
    desired = json.dumps(render_conf(), indent=2, sort_keys=True)
    current = CONF.read_text() if CONF.exists() else None
    changed = current != desired
    if changed:
        CONF.write_text(desired)
        CONF.chmod(0o600)
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


def client():
    from openviking_sdk import SyncHTTPClient

    c = SyncHTTPClient(url=URL)
    c.initialize()
    return c


def list_uris(c, root: str) -> list:
    """Flat URI listing under a root; tolerate an absent tree."""
    try:
        entries = c.tree(root)
    except Exception:
        return []
    uris = []

    def walk(node):
        if isinstance(node, dict):
            uri = node.get("uri")
            if uri:
                uris.append(uri)
            for child in node.get("children") or []:
                walk(child)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(entries)
    return uris


def cmd_status() -> int:
    ok = healthy()
    resources = 0
    if ok:
        try:
            c = client()
            resources = len(list_uris(c, "viking://resources/context"))
            c.close()
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
            {"healthy": ok, "resources": resources, "workspace_bytes": workspace_bytes}
        )
    )
    return 0


def add_resource(c, path: pathlib.Path, to: str, wait: bool = True) -> bool:
    if not path.exists():
        return False
    try:
        c.rm(to, recursive=True, wait=True)
    except Exception:
        pass  # first ingest — nothing to replace
    c.add_resource(str(path), to=to, wait=wait, timeout=600)
    return True


def cmd_add_resource(path: str, to: str, wait: bool) -> int:
    p = pathlib.Path(path).expanduser()
    if not p.is_absolute():
        p = HOME / p
    c = client()
    try:
        added = add_resource(c, p, to, wait=wait)
    finally:
        c.close()
    print(json.dumps({"ok": added, "uri": to}))
    return 0 if added else 1


def cmd_rm(uri: str) -> int:
    c = client()
    try:
        try:
            c.rm(uri, recursive=True, wait=True)
        except Exception:
            pass  # already gone
    finally:
        c.close()
    print(json.dumps({"ok": True, "uri": uri}))
    return 0


def cmd_reindex() -> int:
    c = client()
    added = []
    try:
        if add_resource(c, IMESSAGE_DIR, IMESSAGE_URI):
            added.append(IMESSAGE_URI)
        if add_resource(c, ONAIROS_MD, ONAIROS_URI):
            added.append(ONAIROS_URI)
    finally:
        c.close()
    print(json.dumps({"ok": True, "added": added}))
    return 0


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


def main() -> int:
    parser = argparse.ArgumentParser(prog="ovctl")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("ensure")
    sub.add_parser("status")
    p_add = sub.add_parser("add-resource")
    p_add.add_argument("path")
    p_add.add_argument("--to", required=True)
    # Enqueue only: the server keeps indexing after ovctl exits. Latency-
    # sensitive callers (the upload path) use this so a slow index never
    # stalls an HTTP response.
    p_add.add_argument("--no-wait", action="store_true")
    p_rm = sub.add_parser("rm")
    p_rm.add_argument("uri")
    sub.add_parser("reindex")
    sub.add_parser("export")
    args = parser.parse_args()
    if args.cmd == "ensure":
        return cmd_ensure()
    if args.cmd == "status":
        return cmd_status()
    if args.cmd == "add-resource":
        return cmd_add_resource(args.path, args.to, wait=not args.no_wait)
    if args.cmd == "rm":
        return cmd_rm(args.uri)
    if args.cmd == "reindex":
        return cmd_reindex()
    if args.cmd == "export":
        return cmd_export()
    return 2


if __name__ == "__main__":
    sys.exit(main())
