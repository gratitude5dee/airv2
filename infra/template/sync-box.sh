#!/usr/bin/env bash
# air 2.0 — baseline sync for an EXISTING box (in-place, never re-fork).
#
# Brings an already-provisioned box up to the current template baseline so
# every user starts from the same setup: air identity + SOUL sections, the
# template skills (air-onboarding, open-miniapp, calendar-native, vault-use,
# shopping-checkout, ...), the creative + air-vault plugins, the air-vault /
# open-miniapp-card CLIs, browser runtime config, and the calendar spine.
#
# Safe to re-run (idempotent). It NEVER touches user data: memory, sessions,
# vault store contents, user-installed skills, per-box secrets (API keys,
# GATEWAY_TOKEN, dashboard auth) are all preserved. It does not reinstall or
# re-pin Hermes — that is the UPGRADE.md §2 in-place migration.
#
# Usage: copy infra/template/ to the box, then run sync-box.sh on it.
set -euo pipefail

HOME_DIR="${HOME:-/home/user}"
HERMES_VENV="$HOME_DIR/.hermes-venv"
ENV_FILE="$HOME_DIR/.hermes/.env"
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -d "$HOME_DIR/.hermes" ] || { echo "FATAL: ~/.hermes missing — not a provisioned box" >&2; exit 1; }
# Boxes forked before the venv moved out of the checkout (archive/restore
# drops gitignored paths) have no ~/.hermes-venv — bootstrap it in place from
# the existing checkout instead of failing the sync.
if [ ! -x "$HERMES_VENV/bin/python" ]; then
  [ -d "$HOME_DIR/hermes-agent" ] || { echo "FATAL: ~/hermes-agent missing — not a provisioned box" >&2; exit 1; }
  echo "hermes venv missing — bootstrapping $HERMES_VENV"
  export PATH="$HOME_DIR/.local/bin:$PATH"
  uv venv "$HERMES_VENV" --python 3.11
  (cd "$HOME_DIR/hermes-agent" && UV_PROJECT_ENVIRONMENT="$HERMES_VENV" uv pip install -e ".[all]" --python "$HERMES_VENV/bin/python") \
    || { rm -rf "$HERMES_VENV"; echo "FATAL: hermes venv bootstrap failed — removed partial venv, re-run sync-box" >&2; exit 1; }
fi

# ── 1. Template skills (replace template-owned dirs; user-installed skills
# under other names are untouched) ───────────────────────────────────────────
mkdir -p "$HOME_DIR/.hermes/skills"
for local_skill in "$TEMPLATE_DIR"/skills/*/; do
  name="$(basename "$local_skill")"
  rm -rf "$HOME_DIR/.hermes/skills/$name"
  cp -r "$local_skill" "$HOME_DIR/.hermes/skills/$name"
done

# ── 2. Plugins: creative + air-vault (code only — vault data lives in the
# encrypted store, never in the plugin dir) ──────────────────────────────────
mkdir -p "$HOME_DIR/.hermes/plugins"
rm -rf "$HOME_DIR/.hermes/plugins/creative"
cp -r "$TEMPLATE_DIR/plugins/creative" "$HOME_DIR/.hermes/plugins/creative"
sed -i '/^CREATIVE_PLUGIN_VERSION=/d' "$ENV_FILE"
echo "CREATIVE_PLUGIN_VERSION=$(python3 -c "import json;print(json.load(open('$TEMPLATE_DIR/plugins/creative/dashboard/manifest.json'))['version'])")" >> "$ENV_FILE"

rm -rf "$HOME_DIR/.hermes/plugins/air-vault"
cp -r "$TEMPLATE_DIR/plugins/air-vault" "$HOME_DIR/.hermes/plugins/air-vault"
rm -rf "$HOME_DIR/.hermes/plugins/air-vault/tests"

# The store key is normally minted per-fork by the control plane; boxes forked
# from an older template never got one. Mint locally — it lives ONLY in this
# box's .env (C18), never printed or persisted anywhere else.
if ! grep -q '^AIR_VAULT_KEY=' "$ENV_FILE"; then
  echo "AIR_VAULT_KEY=$(openssl rand -hex 32)" >> "$ENV_FILE"
fi

sudo tee /usr/local/bin/air-vault >/dev/null <<SH
#!/usr/bin/env bash
set -euo pipefail
if [ -z "\${AIR_VAULT_KEY:-}" ] && [ -f "$HOME_DIR/.hermes/.env" ]; then
  AIR_VAULT_KEY="\$(grep -m1 '^AIR_VAULT_KEY=' "$HOME_DIR/.hermes/.env" | cut -d= -f2- || true)"
  export AIR_VAULT_KEY
fi
# Only present once the owner connected 1Password; op-fill refuses without
# it, and it travels in env — never argv.
if [ -z "\${OP_SERVICE_ACCOUNT_TOKEN:-}" ] && [ -f "$HOME_DIR/.hermes/.env" ]; then
  OP_SERVICE_ACCOUNT_TOKEN="\$(grep -m1 '^OP_SERVICE_ACCOUNT_TOKEN=' "$HOME_DIR/.hermes/.env" | cut -d= -f2- || true)"
  if [ -n "\$OP_SERVICE_ACCOUNT_TOKEN" ]; then export OP_SERVICE_ACCOUNT_TOKEN; fi
fi
exec "$HERMES_VENV/bin/python" "$HOME_DIR/.hermes/plugins/air-vault/cli.py" "\$@"
SH
sudo chmod +x /usr/local/bin/air-vault

sudo tee /usr/local/bin/open-miniapp-card >/dev/null <<SH
#!/usr/bin/env bash
set -euo pipefail
kind="\${1:?usage: open-miniapp-card <kind>}"
base="\$(grep -m1 '^OPENAI_BASE_URL=' "$HOME_DIR/.hermes/.env" | cut -d= -f2-)"
key="\$(grep -m1 '^OPENAI_API_KEY=' "$HOME_DIR/.hermes/.env" | cut -d= -f2-)"
exec curl -fsS -X POST "\${base%/api/gateway/v1}/api/cards/\${kind}" \\
  -H "Authorization: Bearer \$key"
SH
sudo chmod +x /usr/local/bin/open-miniapp-card

chmod +x "$HOME_DIR/.hermes/skills/create-miniapp/scripts/air-create"
sudo ln -sf "$HOME_DIR/.hermes/skills/create-miniapp/scripts/air-create" /usr/local/bin/air-create

# ── 3. Browser runtime (Node 22 + agent-browser + dedicated CDP profile) ─────
HERMES_NODE="$HOME_DIR/.hermes/node"
# Reinstall when the runtime predates v22 — old boxes carry a node whose
# bundled npm fails its own engine validation, wedging every npm install.
if [ "$("$HERMES_NODE/bin/node" -v 2>/dev/null | cut -d. -f1)" != "v22" ]; then
  curl -fsSLo /tmp/node22.tar.xz https://nodejs.org/dist/v22.22.0/node-v22.22.0-linux-x64.tar.xz
  rm -rf "$HERMES_NODE"
  mkdir -p "$HERMES_NODE"
  tar -xJf /tmp/node22.tar.xz -C "$HERMES_NODE" --strip-components=1
  rm -f /tmp/node22.tar.xz
fi
export PATH="$HERMES_NODE/bin:$PATH"
command -v agent-browser >/dev/null || npm install -g agent-browser --no-audit --no-fund
[ -d "$HOME_DIR/.agent-browser" ] || agent-browser install

# agent-browser parses AGENT_BROWSER_ARGS comma-separated; keep it minimal —
# overriding --remote-debugging-port/--user-data-dir breaks the daemon's own
# port discovery and hangs every CLI call. air-vault finds the CDP port from
# the daemon Chrome's DevToolsActivePort file instead.
sed -i '/^AGENT_BROWSER_ARGS=/d' "$ENV_FILE"
sed -i '/^AIR_BROWSER_DEBUG_PORT=/d' "$ENV_FILE"
echo "AGENT_BROWSER_ARGS=--no-sandbox,--disable-dev-shm-usage" >> "$ENV_FILE"

# Clear any stale daemon left over from before this sync (or a VM resume).
pkill -9 -f 'agent-browser-linu[x]' 2>/dev/null || true
rm -f "$HOME_DIR/.agent-browser"/*.sock "$HOME_DIR/.agent-browser"/*.pid
rm -rf /tmp/agent-browser-*
grep -q '^DISPLAY=' "$ENV_FILE" || echo "DISPLAY=:0" >> "$ENV_FILE"

# ── 3b. Browser Use CLI 3.0 (pinned) + the box-browser-use CDP wrapper ───────
uv tool install --python 3.12 'browser-use==0.13.8'

# ── 3b+. Stripe Link CLI (pinned) — owner-approved payment credentials ───────
command -v link-cli >/dev/null || npm install -g @stripe/link-cli@0.13.1 --no-audit --no-fund
mkdir -p "$HOME_DIR/.hermes/link" && chmod 700 "$HOME_DIR/.hermes/link"

# ── 3b++. 1Password CLI (pinned, checksum-verified) — opt-in fill path ───────
# Installed for everyone, active for nobody: `op` only resolves anything once
# the owner connects 1Password (OP_SERVICE_ACCOUNT_TOKEN in ~/.hermes/.env).
OP_VERSION="2.35.0"
OP_SHA256="4457ade59850b852c64c77164235b34dd0b984ef7826eb0ccd32f1fd78a2ceb7"
if [ "$(op --version 2>/dev/null || true)" != "$OP_VERSION" ]; then
  curl -fsSL -o /tmp/op.zip \
    "https://cache.agilebits.com/dist/1P/op2/pkg/v${OP_VERSION}/op_linux_amd64_v${OP_VERSION}.zip"
  echo "${OP_SHA256}  /tmp/op.zip" | sha256sum -c -
  rm -rf /tmp/op-dist && python3 -m zipfile -e /tmp/op.zip /tmp/op-dist
  sudo install -m 755 /tmp/op-dist/op /usr/local/bin/op
  rm -rf /tmp/op.zip /tmp/op-dist
  op --version
fi

sudo tee /usr/local/bin/box-browser-use >/dev/null <<SH
#!/usr/bin/env bash
set -euo pipefail
# Attach the Browser Use CLI to this box's headed daemon Chrome over CDP.
# The daemon launches Chrome with --remote-debugging-port=0; the chosen port
# is read from the newest DevToolsActivePort file (same discovery as
# air-vault). Without a running daemon Chrome the CLI's own local flow runs.
if [ -z "\${BU_CDP_URL:-}" ]; then
  port_file="\$(ls -t /tmp/agent-browser-chrome-*/DevToolsActivePort 2>/dev/null | head -1 || true)"
  if [ -n "\$port_file" ]; then
    BU_CDP_URL="http://127.0.0.1:\$(head -1 "\$port_file")"
    export BU_CDP_URL
  fi
fi
exec "$HOME_DIR/.local/bin/browser-use" "\$@"
SH
sudo chmod +x /usr/local/bin/box-browser-use

sed -i '/^PATH=/d' "$ENV_FILE"
echo "PATH=$HERMES_NODE/bin:$HOME_DIR/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" >> "$ENV_FILE"
grep -q 'hermes/node/bin' "$HOME_DIR/.bashrc" || \
  echo "export PATH=\"$HERMES_NODE/bin:\$PATH\"" >> "$HOME_DIR/.bashrc"
bash "$TEMPLATE_DIR/install-command-env.sh"
chmod 600 "$ENV_FILE"

# ── 3c. OpenViking deep memory (docs/memory-upgrade.md, layer 2) ───────────
# Boxes forked before the deep-memory layer never got the venv/service. The
# workspace (~/.openviking/data) is user data — never touched here.
# The install runs unconditionally so an existing venv is upgraded to the
# pinned version (0.4.13's semantic retrieval is broken — zero-result queries
# with "Strings must be encoded before hashing" errors; 0.4.16 fixes it).
OV_VENV="$HOME_DIR/.openviking-venv"
if [ ! -x "$OV_VENV/bin/openviking-server" ]; then
  uv venv "$OV_VENV" --python 3.12 || true
fi
sudo apt-get install -y --no-install-recommends cmake build-essential
CMAKE_ARGS="-DGGML_NATIVE=OFF" uv pip install --python "$OV_VENV/bin/python" --no-binary llama-cpp-python 'openviking[local-embed]==0.4.16' 'openviking-sdk==0.1.7'
mkdir -p "$HOME_DIR/.openviking" && chmod 700 "$HOME_DIR/.openviking"
cp "$TEMPLATE_DIR/openviking/ovctl.py" "$HOME_DIR/.openviking/ovctl.py"
chmod 755 "$HOME_DIR/.openviking/ovctl.py"

sudo tee /usr/local/bin/ovctl >/dev/null <<SH
#!/usr/bin/env bash
set -euo pipefail
exec "$OV_VENV/bin/python" "$HOME_DIR/.openviking/ovctl.py" "\$@"
SH
sudo chmod +x /usr/local/bin/ovctl

# ── 4. Calendar spine ────────────────────────────────────────────────────────
mkdir -p "$HOME_DIR/.hermes/calendar/inbox"
chmod 700 "$HOME_DIR/.hermes/calendar"
cp "$TEMPLATE_DIR/calendar/sync.py" "$HOME_DIR/.hermes/calendar/sync.py"
chmod 755 "$HOME_DIR/.hermes/calendar/sync.py"

# ── 5. Reconcile template instructions, preserving owner content ───────────
python3 "$TEMPLATE_DIR/manage-soul.py" "$HOME_DIR/.hermes/SOUL.md"

# ── 6. config.yaml: plugin allow-list, vault secret source, memory block ─────
python3 - "$HOME_DIR/.hermes/config.yaml" <<'PYEOF'
import sys, yaml, pathlib
p = pathlib.Path(sys.argv[1])
cfg = yaml.safe_load(p.read_text()) if p.exists() else None
cfg = cfg if isinstance(cfg, dict) else {}
plugins = cfg.get("plugins")
plugins = plugins if isinstance(plugins, dict) else {}
enabled = plugins.get("enabled")
enabled = enabled if isinstance(enabled, list) else []
for name in ("creative", "air_vault"):
    if name not in enabled:
        enabled.append(name)
plugins["enabled"] = sorted(enabled)
cfg["plugins"] = plugins
secrets = cfg.get("secrets")
secrets = secrets if isinstance(secrets, dict) else {}
air_vault = secrets.get("air_vault")
air_vault = air_vault if isinstance(air_vault, dict) else {}
air_vault["enabled"] = True
secrets["air_vault"] = air_vault
cfg["secrets"] = secrets
# MA9.1: boxes forked before the memory block never got it.
if not isinstance(cfg.get("memory"), dict):
    cfg["memory"] = {
        "memory_enabled": True,
        "user_profile_enabled": True,
        "write_approval": False,
    }
# The box IS the computer: headed browser, built-in browser_* tools.
if not isinstance(cfg.get("browser"), dict):
    cfg["browser"] = {"headed": True, "backend": "off"}
# V0 web split: web_search discovers, web_extract reads, browser interacts.
# Template-owned defaults are set only when absent so a user's own backend
# choice (or a control-plane-written vault backend) is never clobbered.
web = cfg.get("web")
web = web if isinstance(web, dict) else {}
web.setdefault("search_backend", "")
web.setdefault("extract_backend", "")
web.setdefault("extract_char_limit", 15000)
web.setdefault("keyless_fallback", True)
web.setdefault("keyless_rescue", True)
cfg["web"] = web
# V0 fast-tier delegation: children run on the abstract "fast" tier
# (gateway-resolved, downgrade-only); provider stays unset so children
# inherit the box's gateway credentials.
delegation = cfg.get("delegation")
delegation = delegation if isinstance(delegation, dict) else {}
delegation.setdefault("model", "fast")
delegation.setdefault("max_concurrent_children", 4)
delegation.setdefault("max_spawn_depth", 1)
cfg["delegation"] = delegation
# Deep memory (docs/memory-upgrade.md): the loopback OpenViking MCP server.
mcp = cfg.get("mcp_servers")
mcp = mcp if isinstance(mcp, dict) else {}
mcp["openviking"] = {"url": "http://127.0.0.1:1933/mcp", "enabled": True}
cfg["mcp_servers"] = mcp
p.write_text(yaml.safe_dump(cfg, default_flow_style=False))
PYEOF

# ── 7. C24 gate on the final config, then restart the services ──────────────
"$HERMES_VENV/bin/python" "$TEMPLATE_DIR/generate_platforms.py" \
  --hermes-repo "$HOME_DIR/hermes-agent" \
  --config "$HOME_DIR/.hermes/config.yaml" \
  --verify

# Learning plane (goal.md V10 §7, L15): update code in place — never re-fork.
# Owner state in ~/.hermes/learning is untouched; only /opt/air/learning code
# and the service unit refresh.
sudo mkdir -p /opt/air/learning
sudo cp -r "$TEMPLATE_DIR/learning/air_learning" /opt/air/learning/
sudo cp "$TEMPLATE_DIR/learning/pyproject.toml" /opt/air/learning/
sudo chmod -R a+rX /opt/air/learning
sudo install -m 755 "$TEMPLATE_DIR/learning/learningctl.py" /usr/local/bin/learningctl
mkdir -p "$HOME_DIR/.hermes/learning" && chmod 700 "$HOME_DIR/.hermes/learning"

sudo cp "$TEMPLATE_DIR"/hermes-gateway.service /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/hermes-dashboard.service /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/hermes-host.service /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/hermes-sidecar-owner.service /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/hermes-sidecar-owner.timer /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/openviking.service /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/openviking-index.service "$TEMPLATE_DIR"/openviking-index.timer /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/learning/systemd/air-learningd.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openviking-index.timer
sudo systemctl enable hermes-gateway.service hermes-dashboard.service hermes-host.service hermes-sidecar-owner.timer openviking.service air-learningd.service

# Hermes pins each session's system prompt at creation (sessions.system_prompt_hash);
# clearing it makes the next turn rebuild from the current SOUL/skills without touching messages.
if [ -f "$HOME_DIR/.hermes/state.db" ]; then
  if ! sudo systemctl stop hermes-gateway.service hermes-dashboard.service; then
    sudo systemctl start hermes-gateway.service hermes-dashboard.service || true
    exit 1
  fi
  # SQLite -shm/-wal sidecars can come back root-owned after a fork/resume,
  # which leaves the store read-only for Hermes and for this script.
  sudo chown "$(id -u):$(id -g)" "$HOME_DIR"/.hermes/*.db "$HOME_DIR"/.hermes/*.db-* 2>/dev/null || true
  python3 - "$HOME_DIR/.hermes/state.db" <<'PY' || { sudo systemctl start hermes-gateway.service hermes-dashboard.service; exit 1; }
import sqlite3
import sys

try:
    with sqlite3.connect(sys.argv[1], timeout=15) as db:
        db.execute(
            "UPDATE sessions "
            "SET system_prompt = NULL, system_prompt_hash = NULL "
            "WHERE system_prompt_hash IS NOT NULL OR system_prompt IS NOT NULL"
        )
        db.execute(
            "DELETE FROM system_prompts "
            "WHERE hash NOT IN ("
            "SELECT system_prompt_hash FROM sessions "
            "WHERE system_prompt_hash IS NOT NULL"
            ")"
        )
except Exception as err:
    print(f"error: could not clear cached system prompts: {err}", file=sys.stderr)
    raise SystemExit(1)
PY
fi

sudo systemctl restart hermes-gateway.service hermes-dashboard.service hermes-host.service hermes-sidecar-owner.timer openviking.service air-learningd.service

# Render ov.conf from this box's per-fork gateway credentials and (re)start
# the server. Best effort: deep memory degrades, the box never breaks.
ovctl ensure || echo "WARN: openviking ensure failed — deep memory degraded" >&2

# Release identity (written by release.sh into the artifact). A sync from a
# working tree has none, and must not leave a stale marker behind: forks of a
# template synced that way take the full post-fork setup.
if [ -f "$TEMPLATE_DIR/RELEASE" ]; then
  cp "$TEMPLATE_DIR/RELEASE" "$HOME_DIR/.hermes/.template-release"
else
  rm -f "$HOME_DIR/.hermes/.template-release"
fi
# Skill manifest: what is on disk right now, so a fork of this box skips only
# the hub installs it really inherits.
python3 "$TEMPLATE_DIR/skills-manifest.py" "$HOME_DIR" "$TEMPLATE_DIR/base-skills.txt"

echo "Baseline sync complete."
