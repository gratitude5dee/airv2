#!/usr/bin/env python3
"""air-vaultd — privileged vault daemon (airvault uid).

Unix socket: /run/air-vaultd/air-vaultd.sock (0660 airvault:airv).
Only uid 1000 (user) and uid 0 may connect — callers in `airv` group reach
the socket; policy is enforced per-verb.

Verb policy:
  open verbs (agent-legal, never emit a value):
      list [--masked], get <id> --field <f>          (masked metadata only),
      type <id> --field <f>                          (CDP field fill),
      totp <id> --type                               (CDP field fill),
      op-list, op-fill --ref op://...
  restricted verbs (require a capability signature):
      apply <inbox-file>, get ... --reveal, totp <id> (print)
      __fetch_source__                               (daemon-internal: full
                                                      secret dict for the
                                                      gateway secret source)

Capability: "--cap <exp>.<nonce>.<b64sig>" where sig is ed25519 over
    b"cap-v1|" + argv_canonical + b"|" + nonce + b"|" + exp
argv_canonical = json.dumps(argv_without_cap, separators=(",", ":")).
Verified against /etc/air-vault/cp-signing.pub. Nonces are single-use and
expire with the capability.

Request:  one JSON line {"argv": ["list","--masked", ...]}
Response: one JSON line {"rc": int, "out": str, "err": str}
"""
import json
import os
import secrets
import socket
import socketserver
import subprocess
import sys
import time

SOCK_DIR = "/var/lib/air-vaultd"
SOCK_PATH = os.path.join(SOCK_DIR, "air-vaultd.sock")
ENV_FILE = "/etc/air-vault/env"
PUBKEY_FILE = "/etc/air-vault/cp-signing.pub"
NONCE_DB = "/var/lib/air-vaultd/nonces.json"
CLI = ["/home/user/.hermes-venv/bin/python", "/home/user/.hermes/plugins/air-vault/cli.py"]

OPEN_VERBS = {"list", "type", "op-list", "op-fill"}
RESTRICTED_VERBS = {"apply"}
INTERNAL_VERBS = {"__fetch_source__"}
ALLOWED_UIDS = {0, 1000}   # + airagent uid resolved below
CELL_OK_VERBS = {"list", "type", "totp", "op-list", "op-fill", "get"}

try:
    import pwd
    _CELL_UID = pwd.getpwnam("airagent").pw_uid
    ALLOWED_UIDS.add(_CELL_UID)
except Exception:
    _CELL_UID = -1


def _peer_cgroup(pid):
    try:
        with open(f"/proc/{pid}/cgroup") as f:
            return f.read()
    except Exception:
        return ""


def _is_gateway_peer(pid):
    return "hermes-gateway.service" in _peer_cgroup(pid)


class VaultdError(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code = code


def _load_env():
    env = dict(os.environ)
    try:
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k] = v
    except FileNotFoundError:
        pass
    return env


def _load_pubkey():
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    with open(PUBKEY_FILE) as f:
        raw = bytes.fromhex(f.read().strip())
    return Ed25519PublicKey.from_public_bytes(raw)


_pubkey_cache = {"key": None, "t": 0.0}


def _verify_cap(argv_with_cap):
    """Extract and verify --cap <exp>.<nonce>.<sig>; returns argv without it."""
    cap = None
    argv = []
    it = iter(range(len(argv_with_cap)))
    skip = False
    for i, a in enumerate(argv_with_cap):
        if skip:
            skip = False
            continue
        if a == "--cap" and i + 1 < len(argv_with_cap):
            cap = argv_with_cap[i + 1]
            skip = True
            continue
        argv.append(a)
    if not cap:
        raise VaultdError("capability_required", "verb requires --cap")
    try:
        exp_s, nonce, sig_b64 = cap.split(".")
        exp = int(exp_s)
        import base64
        sig = base64.urlsafe_b64decode(sig_b64 + "=" * (-len(sig_b64) % 4))
    except Exception:
        raise VaultdError("capability_malformed", "bad cap format")
    if exp < time.time():
        raise VaultdError("capability_expired", "cap expired")
    canon = json.dumps(argv, separators=(",", ":"), ensure_ascii=False)
    msg = b"cap-v1|" + canon.encode() + b"|" + nonce.encode() + b"|" + str(exp).encode()
    key = _load_pubkey()
    try:
        key.verify(sig, msg)
    except Exception:
        raise VaultdError("capability_invalid", "signature verify failed")
    _check_nonce(nonce)
    return argv


def _check_nonce(nonce):
    os.makedirs(os.path.dirname(NONCE_DB), exist_ok=True)
    db = {}
    try:
        with open(NONCE_DB) as f:
            db = json.load(f)
    except Exception:
        db = {}
    now = time.time()
    db = {k: v for k, v in db.items() if v > now}
    if nonce in db:
        raise VaultdError("nonce_reused", "capability nonce already spent")
    db[nonce] = now + 3600
    tmp = NONCE_DB + ".tmp"
    with open(tmp, "w") as f:
        json.dump(db, f)
    os.replace(tmp, NONCE_DB)


def _classify(argv):
    if not argv:
        raise VaultdError("empty_argv", "no verb")
    verb = argv[0]
    if verb in INTERNAL_VERBS:
        return "internal"
    if verb in RESTRICTED_VERBS:
        return "restricted"
    if verb in OPEN_VERBS:
        return "open"
    if verb == "get":
        return "restricted" if "--reveal" in argv else "open"
    if verb == "totp":
        return "open" if "--type" in argv else "restricted"
    raise VaultdError("unknown_verb", f"verb {verb!r} not recognized")


def _fetch_source(env):
    """Internal verb: secret-source fetch() payload over UDS.

    Returns {"env_secrets": {ENV_VAR: value}, "redact_values": [...],
    "items_meta": [...]} — env_secrets are env_var-bound injection values
    only; redact_values covers every stored secret for the scrub registry.
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "vault_store", "/home/user/.hermes/plugins/air-vault/vault_store.py")
    vs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(vs)
    home = env.get("HERMES_HOME", "/home/user/.hermes")
    key = env.get("AIR_VAULT_KEY", "").strip()
    if not key:
        return {"rc": 2, "out": "", "err": json.dumps(
            {"error": "key_missing", "message": "AIR_VAULT_KEY not set"})}
    path = vs.store_path(__import__("pathlib").Path(home))
    if not path.is_file():
        return {"rc": 0, "out": json.dumps(
            {"env_secrets": {}, "redact_values": [], "items_meta": [],
             "empty_vault": True}), "err": ""}
    store = vs.load_store(path, key)
    env_secrets, redact, items = {}, [], []
    for it in store.get("items", []):
        meta = {k: v for k, v in it.items() if k not in ("fields", "totp_seed")}
        meta["fields"] = list((it.get("fields") or {}).keys())
        items.append(meta)
        for fval in (it.get("fields") or {}).values():
            if isinstance(fval, str) and fval:
                redact.append(fval)
        if it.get("totp_seed"):
            redact.append(it["totp_seed"])
        ev = it.get("env_var")
        if ev:
            val = vs.injection_value(it)
            if val:
                env_secrets[ev] = val
    return {"rc": 0, "out": json.dumps(
        {"env_secrets": env_secrets, "redact_values": redact,
         "items_meta": items}), "err": ""}


def handle_request(line, pid, uid):
    req = json.loads(line)
    argv = req.get("argv") or []
    if not isinstance(argv, list) or not all(isinstance(a, str) for a in argv):
        raise VaultdError("bad_request", "argv must be a list of strings")
    if len(argv) > 64:
        raise VaultdError("bad_request", "argv too long")
    kind = _classify(argv)
    if uid == _CELL_UID:
        # cell uid: open fill/metadata verbs only; "get" without --reveal
        verb = argv[0]
        if verb not in CELL_OK_VERBS or (verb == "get" and "--reveal" in argv):
            raise VaultdError("denied", f"verb {verb!r} not allowed from cell")
    env = _load_env()
    if kind == "internal":
        # gateway-peer-only verb: the gateway's secret source fetches values
        # over this channel; the cell cannot reach it (cgroup-checked).
        if not (uid == 0 or _is_gateway_peer(pid)):
            raise VaultdError("denied", "internal verb requires gateway peer")
        return _fetch_source(env)
    if kind == "restricted":
        argv = _verify_cap(argv)
    env.pop("AIR_VAULT_KEY_FILE", None)
    env["HERMES_HOME"] = "/home/user/.hermes"
    proc = subprocess.run(
        CLI + argv, capture_output=True, text=True, timeout=120,
        env=env, cwd="/",
    )
    return {"rc": proc.returncode, "out": proc.stdout, "err": proc.stderr}


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            creds = self.request.getsockopt(
                socket.SOL_SOCKET, socket.SO_PEERCRED,
                struct_size := 12)
            pid, uid, gid = __import__("struct").unpack("iii", creds)
        except Exception:
            pid, uid = -1, -1
        try:
            if uid not in ALLOWED_UIDS:
                raise VaultdError("denied", f"uid {uid} not permitted")
            line = self.rfile.readline(1 << 20).decode("utf-8", "replace")
            res = handle_request(line, pid, uid)
        except VaultdError as e:
            res = {"rc": 2, "out": "", "err": json.dumps({"error": e.code, "message": str(e)})}
        except Exception as e:
            res = {"rc": 2, "out": "", "err": json.dumps({"error": "internal", "message": str(e)[:300]})}
        self.wfile.write((json.dumps(res) + "\n").encode())
        _audit(pid, uid, line[:200], res) if 'line' in dir() else None


def _audit(pid, uid, req_head, res):
    try:
        os.makedirs("/var/lib/air-vaultd", exist_ok=True)
        with open("/var/lib/air-vaultd/audit.log", "a") as f:
            f.write(json.dumps({"t": time.time(), "pid": pid, "uid": uid,
                                "req": req_head[:200], "rc": res.get("rc")}) + "\n")
    except Exception:
        pass


def main():
    os.makedirs(SOCK_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(NONCE_DB), exist_ok=True)
    try:
        os.unlink(SOCK_PATH)
    except FileNotFoundError:
        pass
    srv = socketserver.ThreadingUnixStreamServer(SOCK_PATH, Handler)
    # socket group = our egid (airv via the unit's Group=); dir perms are set
    # by apply-posture.sh — the daemon is unprivileged and cannot chown.
    os.chmod(SOCK_PATH, 0o660)
    print("air-vaultd listening", SOCK_PATH, flush=True)
    srv.serve_forever()


def _gid(name):
    import grp
    return grp.getgrnam(name).gr_gid


if __name__ == "__main__":
    main()
