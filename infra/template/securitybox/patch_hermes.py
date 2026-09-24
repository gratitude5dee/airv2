#!/usr/bin/env python3
"""Patch pinned Hermes source to route shell spawns through air-cell.

Wraps argv at the three construction sites:
  tools/environments/local.py::_run_bash         (foreground commands)
  tools/process_registry.py  pipe-mode shell_argv (background, feeds scope+raw)
  tools/process_registry.py  pty_argv             (PTY background)

Idempotent: skips if AIR_CELL marker already present. Fails loudly if the
anchor strings move — never silently skips a wrap.
"""
import os, sys

ROOT = "/home/user/hermes-agent"
CELL = '"/usr/local/libexec/air-cell"'

HELPER = '''

_AIR_CELL_BIN = "/usr/local/libexec/air-cell"


def _air_cell_argv(args):
    """Route a shell spawn through the air-cell confinement launcher.

    No-op when the launcher is absent, not executable, AIR_CELL_DISABLE=1,
    or the caller is already the cell user (prevents recursive wrapping when
    a celled process spawns a subshell through the same code path).
    """
    import os as _os
    import shutil as _sh
    if _os.environ.get("AIR_CELL_DISABLE") == "1":
        return list(args)
    if _os.environ.get("AIR_CELL") == "1":
        return list(args)
    if _os.getuid() != 1000:
        return list(args)
    if _os.path.isfile(_AIR_CELL_BIN) and _os.access(_AIR_CELL_BIN, _os.X_OK):
        return [_AIR_CELL_BIN, "--", *args]
    return list(args)
'''

def patch(path, rules):
    p = os.path.join(ROOT, path)
    src = open(p).read()
    if "_air_cell_argv" in src:
        print(f"SKIP {path} (already patched)")
        return
    bak = p + ".precell"
    if not os.path.exists(bak):
        open(bak, "w").write(src)
    for old, new in rules:
        if old not in src:
            print(f"FAIL {path}: anchor missing: {old[:70]!r}")
            sys.exit(1)
        src = src.replace(old, new, 1)
    open(p, "w").write(src)
    print(f"PATCHED {path}")

# local.py: add helper after the module docstring/imports; wrap args in _run_bash
patch("tools/environments/local.py", [
    # helper insert: before the first top-level def _find_bash
    ("def _find_bash() -> str:",
     HELPER.strip() + "\n\n\ndef _find_bash() -> str:"),
    ('        args = [bash, "-l", "-c", cmd_string] if login else [bash, "-c", cmd_string]',
     '        args = [bash, "-l", "-c", cmd_string] if login else [bash, "-c", cmd_string]\n        args = _air_cell_argv(args)'),
])

patch("tools/process_registry.py", [
    ("def _systemd_run_user_scope_available() -> bool:",
     HELPER.strip() + "\n\n\ndef _systemd_run_user_scope_available() -> bool:"),
    ('                pty_argv = [user_shell, "-lic", f"set +m; {safe_command}"]',
     '                pty_argv = [user_shell, "-lic", f"set +m; {safe_command}"]\n                pty_argv = _air_cell_argv(pty_argv)'),
    ('        shell_argv = [user_shell, "-lic", f"set +m; {safe_command}"]',
     '        shell_argv = [user_shell, "-lic", f"set +m; {safe_command}"]\n        shell_argv = _air_cell_argv(shell_argv)'),
])
print("ALL PATCHES APPLIED")

# --- vault_source.py: daemon-mode fetch ------------------------------------
VS = "/home/user/.hermes/plugins/air-vault/vault_source.py"
vs_src = open(VS).read()
if "_fetch_via_daemon" not in vs_src:
    anchor = "    def fetch(self, cfg: dict, home_path: Path) -> FetchResult:"
    helper = '''    def _fetch_via_daemon(self, cfg, home_path):
        """Try the privilege-separated vault daemon first. Returns None when
        the daemon socket is absent (legacy boxes) so callers fall back to
        direct file access."""
        import json as _json, socket as _socket
        sock = "/var/lib/air-vaultd/air-vaultd.sock"
        if not os.path.exists(sock):
            return None
        s = _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM)
        s.settimeout(10)
        s.connect(sock)
        s.sendall(_json.dumps({"argv": ["__fetch_source__"]}).encode() + b"\\n")
        s.shutdown(_socket.SHUT_WR)
        buf = b""
        while True:
            chunk = s.recv(1 << 20)
            if not chunk:
                break
            buf += chunk
        res = _json.loads(buf.decode())
        if res.get("rc") != 0:
            return None
        payload = _json.loads(res.get("out") or "{}")
        result = FetchResult()
        _register_redaction(payload.get("redact_values") or [])
        for ev, val in (payload.get("env_secrets") or {}).items():
            result.secrets[ev] = val
        return result

'''
    vs_src = vs_src.replace(anchor, helper + anchor, 1)
    call_anchor = '''        result = FetchResult()
        try:
            env = get_source_environment()'''
    call_new = '''        result = FetchResult()
        try:
            via_daemon = self._fetch_via_daemon(cfg, home_path)
            if via_daemon is not None:
                return via_daemon
        except Exception:
            logger.warning("air-vault: daemon fetch failed, falling back", exc_info=True)
        try:
            env = get_source_environment()'''
    if call_anchor not in vs_src:
        print("FAIL vault_source: fetch anchor missing")
        sys.exit(1)
    vs_src = vs_src.replace(call_anchor, call_new, 1)
    open(VS + ".precell", "w").write(open(VS).read()) if not os.path.exists(VS + ".precell") else None
    open(VS, "w").write(vs_src)
    print("PATCHED vault_source.py")
else:
    print("SKIP vault_source.py (already patched)")

import subprocess as _sp
r = _sp.run(["/home/user/.hermes-venv/bin/python", "-m", "py_compile", VS],
            capture_output=True, text=True)
print("vault_source compile:", r.returncode, r.stderr[:200])
