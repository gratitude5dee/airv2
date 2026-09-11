#!/usr/bin/env python3
"""air_transfer.py — per-migration export/import tool staged onto each box.

The control plane installs this at ~/.air/air_transfer.py on both sides of a
compute migration and drives it over the provider command channel. The wire
format:

    AIRX1\n
    <header json>\n                     {"v":1,"manifest_sha256":...,"pass":n}
    <4-byte len><12-byte nonce><ct+tag>  repeated; AES-256-GCM, 8MiB chunks,
                                        AAD = header line + chunk index

SQLite state always crosses as a consistent `conn.backup()` snapshot taken
into the staging tree — never a raw file copy — so a live precopy is still
internally consistent and the final (quiesced) pass is authoritative.

Secrets never touch argv: key/token come via --keyfile/--tokenfile (0600).
"""

from __future__ import annotations

import argparse
import hashlib
import http.server
import json
import os
import shutil
import sqlite3
import stat
import sys
import tarfile
import tempfile
import time
import urllib.request
from pathlib import Path

MAGIC = b"AIRX1\n"
CHUNK = 8 * 1024 * 1024
SQLITE_MAGIC = b"SQLite format 3\x00"

# Directories pruned from the walk — trees whose entire contents classify as
# regenerate under lib/migration/inventory.ts RULES, so skipping the hash loses
# nothing. Anything that can hold user state (.local, .config/google-chrome)
# is deliberately NOT here: it is walked and classified like everything else.
# Pruned dirs are emitted as a single 'dir' entry so the manifest still
# records their presence.
PRUNE_DIRS = {
    ".air", "node_modules", "__pycache__", ".hermes-venv",
    ".openviking-venv", ".agent-browser", ".vscode-server", ".cache",
    ".npm", ".pnpm-store", "dist", ".next", ".turbo", "hermes-agent",
    ".rustup", ".cargo",
}


def _key(path: str) -> bytes:
    raw = Path(path).read_text().strip()
    try:
        key = bytes.fromhex(raw)
    except ValueError:
        key = raw.encode()
    if len(key) != 32:
        raise SystemExit(f"keyfile {path}: need 32 bytes, got {len(key)}")
    return key


def _token(path: str) -> str:
    return Path(path).read_text().strip()


def _aesgcm():
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    return AESGCM


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def is_sqlite(path: Path) -> bool:
    try:
        with path.open("rb") as fh:
            return fh.read(16) == SQLITE_MAGIC
    except OSError:
        return False


def rel(home: Path, path: Path) -> str:
    return str(path.relative_to(home))


# ─── inventory ───────────────────────────────────────────────────────────────

def cmd_inventory(args: argparse.Namespace) -> int:
    home = Path(args.home).resolve()
    entries = []
    for root, dirs, files in os.walk(home):
        root_p = Path(root)
        rel_root = rel(home, root_p) if root_p != home else ""
        pruned = [
            d for d in dirs
            if d in PRUNE_DIRS
            or (f"{rel_root}/{d}" if rel_root else d) in PRUNE_DIRS
        ]
        for d in pruned:
            dirs.remove(d)
            path = root_p / d
            try:
                st = path.lstat()
            except OSError:
                continue
            entries.append({
                "path": rel(home, path), "kind": "dir",
                "bytes": 0, "sha256": "", "mtime": st.st_mtime,
            })
        for name in files:
            path = root_p / name
            try:
                st = path.lstat()
            except OSError:
                continue
            if stat.S_ISLNK(st.st_mode):
                entries.append({
                    "path": rel(home, path), "kind": "symlink",
                    "bytes": 0, "sha256": "",
                    "mtime": st.st_mtime,
                    "link": os.readlink(path),
                })
                continue
            if not stat.S_ISREG(st.st_mode):
                continue
            kind = "sqlite" if is_sqlite(path) else "file"
            entries.append({
                "path": rel(home, path),
                "kind": kind,
                "bytes": st.st_size,
                "sha256": sha256_file(path),
                "mtime": st.st_mtime,
            })
    out = {"version": 1, "scanned_at": time.time(), "home": str(home), "entries": entries}
    Path(args.out).write_text(json.dumps(out))
    print(json.dumps({"entries": len(entries), "out": args.out}))
    return 0


# ─── export ──────────────────────────────────────────────────────────────────

def _safe_rel(path: str) -> str:
    """Refuse a manifest path that escapes the home tree."""
    if not path or path.startswith("/") or path.startswith("~"):
        raise SystemExit(f"unsafe manifest path {path!r}")
    if any(part == ".." for part in path.split("/")):
        raise SystemExit(f"unsafe manifest path {path!r}")
    return path


def _transfer_paths(manifest: dict) -> list[dict]:
    out = []
    for e in manifest["entries"]:
        if e.get("classification") in ("transfer", "reconnect") and e.get("kind") != "dir":
            e["path"] = _safe_rel(e["path"])
            if e.get("kind") == "symlink":
                # A symlink's target is data, not a filesystem path to open —
                # but refuse absolute/out-of-tree targets anyway: apply would
                # recreate a link pointing at e.g. /etc or ~/.ssh.
                _safe_rel_link(e.get("link", ""), e["path"])
            out.append(e)
    return out


def _safe_rel_link(link: str, path: str) -> None:
    """Resolve a relative symlink target from its own dir; refuse escapes."""
    if not link:
        raise SystemExit(f"symlink {path!r} has no target")
    if link.startswith("/"):
        raise SystemExit(f"symlink {path!r} escapes home: {link!r}")
    depth = len([p for p in path.split("/")[:-1] if p])
    for part in link.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            depth -= 1
            if depth < 0:
                raise SystemExit(f"symlink {path!r} escapes home: {link!r}")
        else:
            depth += 1


def _safe_extract(tar: tarfile.TarFile, dest: Path) -> None:
    """Extract only members that resolve inside dest (no traversal)."""
    dest_r = dest.resolve()
    for member in tar.getmembers():
        target = (dest_r / member.name).resolve()
        if not str(target).startswith(str(dest_r) + os.sep) and target != dest_r:
            raise SystemExit(f"unsafe member {member.name}")
        if member.isdev():
            raise SystemExit(f"device member {member.name} refused")
        if member.issym() or member.islnk():
            # A link's own name sits inside dest, but its TARGET must too:
            # symlink targets resolve against the link's parent dir; hardlink
            # names are archive-rooted member paths.
            ln = member.linkname
            if ln.startswith("/"):
                resolved = Path(ln)
            elif member.issym():
                resolved = (target.parent / ln).resolve()
            else:
                resolved = (dest_r / ln).resolve()
            if not str(resolved).startswith(str(dest_r) + os.sep) and resolved != dest_r:
                raise SystemExit(f"link member {member.name} escapes: {ln}")
    tar.extractall(dest_r)


def cmd_export(args: argparse.Namespace) -> int:
    home = Path(args.home).resolve()
    manifest = json.loads(Path(args.manifest).read_text())
    staging = Path(args.staging)
    staging.mkdir(parents=True, exist_ok=True)
    key = _key(args.keyfile)

    # SQLite entries are staged through the backup API so the tar always
    # carries a consistent database even mid-write.
    stage_root = staging / "files"
    if stage_root.exists():
        shutil.rmtree(stage_root)
    stage_root.mkdir()
    tar_path = staging / "payload.tar"

    entries = _transfer_paths(manifest)
    exported, missing = [], []
    with tarfile.open(tar_path, "w") as tar:
        for entry in entries:
            src = home / entry["path"]
            if entry["kind"] == "symlink":
                if src.is_symlink():
                    tar.add(src, arcname=entry["path"], recursive=False)
                    exported.append(entry["path"])
                else:
                    missing.append(entry["path"])
                continue
            if not src.is_file():
                missing.append(entry["path"])
                continue
            if entry["kind"] == "sqlite":
                staged = stage_root / entry["path"]
                staged.parent.mkdir(parents=True, exist_ok=True)
                try:
                    src_db = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
                    dst_db = sqlite3.connect(staged)
                    src_db.backup(dst_db)
                    dst_db.close()
                    src_db.close()
                    tar.add(staged, arcname=entry["path"], recursive=False)
                except sqlite3.Error as exc:
                    raise SystemExit(f"sqlite backup failed for {entry['path']}: {exc}")
            else:
                tar.add(src, arcname=entry["path"], recursive=False)
            exported.append(entry["path"])

    AESGCM = _aesgcm()
    header = {
        "v": 1,
        "pass": args.pass_name,
        "created_at": time.time(),
        "manifest_sha256": hashlib.sha256(
            Path(args.manifest).read_bytes()
        ).hexdigest(),
        "files": len(exported),
    }
    header_line = json.dumps(header, sort_keys=True).encode() + b"\n"
    cipher = AESGCM(key)
    idx = 0
    with tar_path.open("rb") as src, Path(args.out).open("wb") as dst:
        dst.write(MAGIC)
        dst.write(header_line)
        while True:
            chunk = src.read(CHUNK)
            if not chunk:
                break
            nonce = os.urandom(12)
            aad = header_line + idx.to_bytes(8, "big")
            ct = cipher.encrypt(nonce, chunk, aad)
            dst.write(len(ct).to_bytes(4, "big"))
            dst.write(nonce)
            dst.write(ct)
            idx += 1
    receipt = {
        "bundle": str(args.out),
        "bundle_sha256": sha256_file(Path(args.out)),
        "bytes": Path(args.out).stat().st_size,
        "files": len(exported),
        "missing": missing,
    }
    Path(args.receipt_out).write_text(json.dumps(receipt))
    print(json.dumps(receipt))
    return 0


# ─── serve ───────────────────────────────────────────────────────────────────

def cmd_serve(args: argparse.Namespace) -> int:
    token = _token(args.tokenfile)
    bundle = Path(args.bundle)
    deadline = time.time() + args.seconds
    state = {"served": 0}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            if self.headers.get("authorization") != f"Bearer {token}":
                self.send_error(403)
                return
            size = bundle.stat().st_size
            self.send_response(200)
            self.send_header("content-length", str(size))
            self.end_headers()
            with bundle.open("rb") as fh:
                shutil.copyfileobj(fh, self.wfile, 1024 * 1024)
            state["served"] += 1

        def log_message(self, *a):  # silence per-request logging
            return

    server = http.server.HTTPServer(("0.0.0.0", args.port), Handler)
    server.timeout = 5
    while state["served"] < args.max_requests and time.time() < deadline:
        server.handle_request()
    print(json.dumps({"served": state["served"]}))
    return 0


# ─── import ──────────────────────────────────────────────────────────────────

def _read_exact(stream, n: int) -> bytes:
    buf = b""
    while len(buf) < n:
        part = stream.read(n - len(buf))
        if not part:
            raise SystemExit("bundle truncated")
        buf += part
    return buf


def cmd_import(args: argparse.Namespace) -> int:
    key = _key(args.keyfile)
    token = _token(args.tokenfile)
    dest = Path(args.dest)
    dest.mkdir(parents=True, exist_ok=True)
    AESGCM = _aesgcm()
    cipher = AESGCM(key)

    req = urllib.request.Request(
        args.url, headers={"authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req, timeout=args.timeout) as resp:
        magic = _read_exact(resp, len(MAGIC))
        if magic != MAGIC:
            raise SystemExit("bad bundle magic")
        header_line = b""
        while not header_line.endswith(b"\n"):
            header_line += _read_exact(resp, 1)
        header = json.loads(header_line)
        tar_path = dest / "payload.tar"
        idx = 0
        with tar_path.open("wb") as out:
            while True:
                prefix = resp.read(4)
                if not prefix:
                    break
                if len(prefix) < 4:
                    raise SystemExit("bundle truncated mid-chunk")
                n = int.from_bytes(prefix, "big")
                nonce = _read_exact(resp, 12)
                ct = _read_exact(resp, n)
                aad = header_line + idx.to_bytes(8, "big")
                out.write(cipher.decrypt(nonce, ct, aad))
                idx += 1

    stage_root = dest / "files"
    if stage_root.exists():
        shutil.rmtree(stage_root)
    stage_root.mkdir()
    with tarfile.open(tar_path) as tar:
        _safe_extract(tar, stage_root)
    receipt = {
        "header": header,
        "tar_sha256": sha256_file(tar_path),
        "files_dir": str(stage_root),
    }
    Path(dest / "import.json").write_text(json.dumps(receipt))
    print(json.dumps(receipt))
    return 0


# ─── apply ───────────────────────────────────────────────────────────────────

def cmd_apply(args: argparse.Namespace) -> int:
    home = Path(args.home).resolve()
    staging = Path(args.staging)
    manifest = json.loads(Path(args.manifest).read_text())
    stage_root = staging / "files"
    applied_path = home / ".air" / "applied.json"

    wanted = _transfer_paths(manifest)
    wanted_paths = {e["path"] for e in wanted}

    applied, missing = [], []
    for entry in wanted:
        src = stage_root / entry["path"]
        dst = home / entry["path"]
        if entry["kind"] == "symlink":
            if src.is_symlink():
                dst.parent.mkdir(parents=True, exist_ok=True)
                if dst.exists() or dst.is_symlink():
                    dst.unlink()
                dst.symlink_to(os.readlink(src))
                applied.append(entry["path"])
                continue
            missing.append(entry["path"])
            continue
        if not src.is_file():
            missing.append(entry["path"])
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        tmp = dst.with_name(dst.name + ".airtmp")
        shutil.copyfile(src, tmp)
        os.chmod(tmp, stat.S_IMODE(src.stat().st_mode) or 0o600)
        os.replace(tmp, dst)
        applied.append(entry["path"])

    # Deletions: remove only paths a previous pass applied that the current
    # manifest no longer wants — never unlisted user files.
    deleted = []
    previous = set()
    if applied_path.exists():
        try:
            previous = set(json.loads(applied_path.read_text()))
        except json.JSONDecodeError:
            previous = set()
    for old in previous - wanted_paths:
        victim = home / old
        try:
            if victim.is_symlink() or victim.is_file():
                victim.unlink()
                deleted.append(old)
        except OSError:
            pass

    applied_path.parent.mkdir(parents=True, exist_ok=True)
    applied_path.write_text(json.dumps(sorted(wanted_paths)))
    print(json.dumps({"applied": len(applied), "missing": missing,
                      "deleted": deleted}))
    return 0


# ─── verify ──────────────────────────────────────────────────────────────────

def cmd_verify(args: argparse.Namespace) -> int:
    home = Path(args.home).resolve()
    manifest = json.loads(Path(args.manifest).read_text())
    mismatches, checked = [], 0
    for entry in _transfer_paths(manifest):
        target = home / entry["path"]
        if entry["kind"] == "sqlite":
            # A sqlite entry crossed as a fresh backup() image — bytes differ
            # from the source file by design, so consistency is proven by the
            # database's own integrity check, not a hash compare.
            if not target.is_file():
                mismatches.append({"path": entry["path"], "reason": "missing"})
                continue
            checked += 1
            try:
                conn = sqlite3.connect(f"file:{target}?mode=ro", uri=True)
                try:
                    verdict = conn.execute("PRAGMA quick_check").fetchone()
                finally:
                    conn.close()
            except sqlite3.Error as error:
                verdict = (f"open failed: {error}",)
            if verdict != ("ok",):
                mismatches.append({"path": entry["path"], "reason": f"quick_check:{verdict[0]}"})
            continue
        if entry["kind"] != "file" or not entry.get("sha256"):
            continue
        if not target.is_file():
            mismatches.append({"path": entry["path"], "reason": "missing"})
            continue
        checked += 1
        if sha256_file(target) != entry["sha256"]:
            mismatches.append({"path": entry["path"], "reason": "sha256"})
    ok = not mismatches
    print(json.dumps({"ok": ok, "checked": checked, "mismatches": mismatches}))
    return 0 if ok else 2


def main() -> int:
    parser = argparse.ArgumentParser(prog="air_transfer")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("inventory")
    p.add_argument("--home", required=True)
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_inventory)

    p = sub.add_parser("export")
    p.add_argument("--home", required=True)
    p.add_argument("--manifest", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--keyfile", required=True)
    p.add_argument("--staging", required=True)
    p.add_argument("--receipt-out", required=True)
    p.add_argument("--pass-name", default="pass")
    p.set_defaults(fn=cmd_export)

    p = sub.add_parser("serve")
    p.add_argument("--bundle", required=True)
    p.add_argument("--tokenfile", required=True)
    p.add_argument("--port", type=int, required=True)
    p.add_argument("--seconds", type=int, default=600)
    p.add_argument("--max-requests", type=int, default=2)
    p.set_defaults(fn=cmd_serve)

    p = sub.add_parser("import")
    p.add_argument("--url", required=True)
    p.add_argument("--tokenfile", required=True)
    p.add_argument("--keyfile", required=True)
    p.add_argument("--dest", required=True)
    p.add_argument("--timeout", type=int, default=300)
    p.set_defaults(fn=cmd_import)

    p = sub.add_parser("apply")
    p.add_argument("--home", required=True)
    p.add_argument("--staging", required=True)
    p.add_argument("--manifest", required=True)
    p.set_defaults(fn=cmd_apply)

    p = sub.add_parser("verify")
    p.add_argument("--home", required=True)
    p.add_argument("--manifest", required=True)
    p.set_defaults(fn=cmd_verify)

    args = parser.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
