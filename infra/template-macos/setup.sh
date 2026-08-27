#!/usr/bin/env bash
# air 2.0 — macOS (darwin/arm64) template setup. Run by bootstrap.sh on a
# fresh Namespace Apple-silicon instance; a port of infra/template/setup.sh:
#   apt → brew, systemd → launchd (per-user LaunchAgents, labels
#   tech.wzrd.air.<service>), X display → native windowing (no DISPLAY; the
#   agent browser opens real macOS windows, screen-shared over VNC), the
#   ascii host routes → Namespace ingress + the control bridge (bridge.py).
#
# Same pinned Hermes, same config.yaml / .env seeding, same plugin/skill/
# calendar/SOUL stack, same C24 platform gate. Per-instance env from the
# control plane: TENANT_ID, GATEWAY_TOKEN, AIR_BRIDGE_TOKEN, AIR_BRIDGE_PORT.
set -euo pipefail

HERMES_REPO="${HERMES_REPO:-https://github.com/NousResearch/hermes-agent.git}"
# V0: pinned Hermes revision — keep in lockstep with infra/template/setup.sh.
HERMES_REF="${HERMES_REF:-7339f5f160db5c96657a3bab60151227cc61f66c}"
HOME_DIR="$HOME"
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_TEMPLATE_DIR="$(cd "$TEMPLATE_DIR/../template" && pwd)"
BIN_DIR="$HOME_DIR/.hermes/bin"
AGENTS_DIR="$HOME_DIR/Library/LaunchAgents"
LOG_DIR="$HOME_DIR/Library/Logs/air"
mkdir -p "$HOME_DIR/.hermes" "$BIN_DIR" "$AGENTS_DIR" "$LOG_DIR"

# ── 0. The bridge FIRST: waitForBridge() is how provisioning knows the build
# finished, and health reports ready only once .bootstrap-complete exists. ───
cp "$TEMPLATE_DIR/bridge.py" "$HOME_DIR/.hermes/bridge.py"
write_agent() { # write_agent <service> <program...>
  local service="$1"; shift
  local args=""
  for arg in "$@"; do args+="    <string>$arg</string>\n"; done
  printf '<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>tech.wzrd.air.%s</string>
  <key>ProgramArguments</key>
  <array>
%b  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>AIR_BRIDGE_TOKEN</key><string>%s</string>
    <key>AIR_BRIDGE_PORT</key><string>%s</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>%s/%s.log</string>
  <key>StandardErrorPath</key><string>%s/%s.err.log</string>
</dict>
</plist>\n' "$service" "$args" "${AIR_BRIDGE_TOKEN:-}" "${AIR_BRIDGE_PORT:-8722}" \
    "$LOG_DIR" "$service" "$LOG_DIR" "$service" \
    > "$AGENTS_DIR/tech.wzrd.air.$service.plist"
  launchctl bootout "gui/$(id -u)/tech.wzrd.air.$service" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS_DIR/tech.wzrd.air.$service.plist"
}
write_agent bridge /usr/bin/python3 "$HOME_DIR/.hermes/bridge.py"

# ── 1. Homebrew + base packages (brew where apt was) ─────────────────────────
if ! command -v brew >/dev/null; then
  NONINTERACTIVE=1 /bin/bash -c \
    "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/opt/homebrew/bin/brew shellenv)"
grep -q 'brew shellenv' "$HOME_DIR/.zprofile" 2>/dev/null || \
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME_DIR/.zprofile"
brew install git jq openssl@3 cmake node@24 python@3.12

# ── 2. Hermes from source at the pinned revision (identical to the box) ─────
if [ ! -d "$HOME_DIR/hermes-agent/.git" ]; then
  git init "$HOME_DIR/hermes-agent"
  git -C "$HOME_DIR/hermes-agent" remote add origin "$HERMES_REPO"
fi
git -C "$HOME_DIR/hermes-agent" fetch --depth 1 origin "$HERMES_REF"
git -C "$HOME_DIR/hermes-agent" checkout --force FETCH_HEAD
git -C "$HOME_DIR/hermes-agent" rev-parse HEAD > "$HOME_DIR/.hermes/.template-hermes-ref"
cd "$HOME_DIR/hermes-agent"
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME_DIR/.local/bin:$PATH"

HERMES_VENV="$HOME_DIR/.hermes-venv"
uv venv "$HERMES_VENV" --python 3.11 || true
UV_PROJECT_ENVIRONMENT="$HERMES_VENV" uv pip install -e ".[all]" --python "$HERMES_VENV/bin/python"
grep -q UV_NO_SYNC "$HOME_DIR/.zprofile" || {
  echo "export UV_NO_SYNC=1" >> "$HOME_DIR/.zprofile"
  echo "export UV_PROJECT_ENVIRONMENT=$HERMES_VENV" >> "$HOME_DIR/.zprofile"
}

# ── 3. Dashboard SPA at template time ────────────────────────────────────────
export PATH="$(brew --prefix node@24)/bin:$PATH"
# hermes-agent's engines field rejects the npm that ships with node@24
# (needs <11.10.0 || >=11.17.0), so move npm forward first. The upgrade lands
# in npm's global prefix, not the node@24 keg bin — and that prefix's bin may
# also carry a different node, so invoke the new npm explicitly (its
# `#!/usr/bin/env node` shebang keeps resolving node@24 from PATH).
npm install -g npm@'>=11.17.0' --no-audit --no-fund
NPM="$(npm prefix -g)/bin/npm"
"$NPM" --version
(cd web && "$NPM" ci && "$NPM" run build)
test -n "$(ls -A hermes_cli/web_dist 2>/dev/null)" || {
  echo "FATAL: hermes_cli/web_dist/ is empty — dashboard SPA did not build" >&2
  exit 1
}
rm -rf "$HOME_DIR/.hermes/web_dist"
cp -r "$HOME_DIR/hermes-agent/hermes_cli/web_dist" "$HOME_DIR/.hermes/web_dist"

# ── 4. config.yaml — the same seed as the box (C12/C24), no display block
# to adapt: macOS windowing is native, headed just means real windows. ───────
cat > "$HOME_DIR/.hermes/config.yaml" <<'YAML'
approvals:
  mode: "smart"
  smart_policy: "ALWAYS ESCALATE any command or browser action that publishes text publicly in the human's name on a social platform (posting, commenting, or replying). Liking/reacting under an enabled standing rule does not need escalation."

terminal:
  backend: "local"

memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: false

browser:
  headed: true
  backend: "off"

# Web three-job split (same seed as the Linux template): web_search discovers,
# web_extract reads, the browser interacts. Backends stay empty — no provider
# key ships in the template (C2); the control plane fills them from the user's
# vault, and the keyless free-tier ring covers the no-key case.
web:
  search_backend: ""
  extract_backend: ""
  extract_char_limit: 15000
  keyless_fallback: true
  keyless_rescue: true

# Delegated children run on the abstract "fast" tier (gateway-resolved,
# downgrade-only); provider stays unset so they inherit the gateway
# credentials. Depth stays 1 — set child_timeout_seconds before raising it.
delegation:
  model: "fast"
  max_concurrent_children: 4
  max_spawn_depth: 1

model:
  default: "balanced"
  provider: "custom"
  base_url: "https://GATEWAY_PLACEHOLDER/api/gateway/v1"

gateway:
  multiplex_profiles: true
YAML

# C24: generate the platform-disable list from the pinned snapshot; the ONE
# copy of the generator lives in the base template dir.
"$HERMES_VENV/bin/python" "$BASE_TEMPLATE_DIR/generate_platforms.py" \
  --hermes-repo "$HOME_DIR/hermes-agent" \
  --config "$HOME_DIR/.hermes/config.yaml"

# ── 5. ~/.hermes/.env — template placeholders; the control plane merges the
# per-instance secrets over the bridge after waitForBridge. ──────────────────
TEMPLATE_API_SERVER_KEY=$(openssl rand -hex 32)
TEMPLATE_DASH_PASSWORD=$(openssl rand -hex 16)
TEMPLATE_DASH_SECRET=$(openssl rand -hex 32)
TEMPLATE_DASH_HASH=$(cd "$HOME_DIR/hermes-agent" && "$HERMES_VENV/bin/python" -c "from plugins.dashboard_auth.basic import hash_password; print(hash_password('$TEMPLATE_DASH_PASSWORD'))")
cat > "$HOME_DIR/.hermes/.env" <<ENV
API_SERVER_KEY=$TEMPLATE_API_SERVER_KEY
API_SERVER_HOST=0.0.0.0
OPENAI_API_KEY=GATEWAY_TOKEN_PLACEHOLDER
HERMES_DASHBOARD_BASIC_AUTH_USERNAME=air
HERMES_DASHBOARD_BASIC_AUTH_PASSWORD_HASH=$TEMPLATE_DASH_HASH
HERMES_DASHBOARD_BASIC_AUTH_SECRET=$TEMPLATE_DASH_SECRET
HERMES_WEB_DIST=$HOME_DIR/.hermes/web_dist
AGENT_BROWSER_ARGS=--disable-dev-shm-usage
ENV
chmod 600 "$HOME_DIR/.hermes/.env"

# ── 6. Browser runtime — the same agent-browser CLI; Chrome opens native
# macOS windows, which is what the VNC screen share shows the human. ─────────
"$NPM" install -g agent-browser --no-audit --no-fund
agent-browser install
uv tool install --python 3.12 'browser-use==0.13.8'
"$NPM" install -g @stripe/link-cli@0.13.1 --no-audit --no-fund
mkdir -p "$HOME_DIR/.hermes/link" && chmod 700 "$HOME_DIR/.hermes/link"

cat > "$BIN_DIR/box-browser-use" <<SH
#!/usr/bin/env bash
set -euo pipefail
if [ -z "\${BU_CDP_URL:-}" ]; then
  port_file="\$(ls -t \$TMPDIR/agent-browser-chrome-*/DevToolsActivePort 2>/dev/null | head -1 || true)"
  if [ -n "\$port_file" ]; then
    BU_CDP_URL="http://127.0.0.1:\$(head -1 "\$port_file")"
    export BU_CDP_URL
  fi
fi
exec "$HOME_DIR/.local/bin/browser-use" "\$@"
SH
chmod +x "$BIN_DIR/box-browser-use"

sed -i '' '/^PATH=/d' "$HOME_DIR/.hermes/.env"
echo "PATH=$BIN_DIR:$(brew --prefix node@24)/bin:$HOME_DIR/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" >> "$HOME_DIR/.hermes/.env"

# ── 7. Daytona CLI + MCP (darwin/arm64 binary; no credential in the template) ─
curl -sfL https://github.com/daytona/clients/releases/latest/download/daytona-darwin-arm64 -o "$BIN_DIR/daytona"
chmod +x "$BIN_DIR/daytona"
rm -rf "$HOME_DIR/.daytona"
printf 'y\n' | "$HERMES_VENV/bin/hermes" mcp add daytona --command "$BIN_DIR/daytona" --args mcp start \
  || echo "WARN: daytona mcp add failed" >&2

# ── 8. Skills, plugins, calendar, OpenViking — the same shared assets ────────
# Same pinned hub set as the Linux template (identifiers confirmed via
# `hermes skills search`, mirrored in apps/web/lib/skills/hub.ts BASE_SKILLS).
for skill in \
  official/email/agentmail \
  official/research/duckduckgo-search \
  official/creative/hyperframes \
  skills-sh/kepano/obsidian-skills/defuddle \
  browser-harness \
  skills-sh/panniantong/agent-reach/agent-reach \
  skills-sh/jakubkrehel/make-interfaces-feel-better/make-interfaces-feel-better \
  skills-sh/addyosmani/agent-skills/browser-testing-with-devtools \
  skills-sh/composiohq/skills/composio \
  skills-sh/zeropointrepo/youtube-skills/youtube-full \
  skills-sh/nousresearch/hermes-agent/humanizer \
  skills-sh/mattpocock/skills/setup-matt-pocock-skills \
  skills-sh/aradotso/trending-skills/skillclaw-skill-evolution \
  skills-sh/aradotso/mcp-skills/codebase-memory-mcp-intelligence \
  skills-sh/forward-future/loopy/loopy \
  skills-sh/calesthio/openmontage/ai-video-gen \
  skills-sh/aradotso/security-skills/anthropic-cybersecurity-skills \
; do
  "$HERMES_VENV/bin/hermes" skills install "$skill" --yes || echo "WARN: base skill $skill install failed" >&2
done
mkdir -p "$HOME_DIR/.hermes/skills"
for local_skill in "$BASE_TEMPLATE_DIR"/skills/*/; do
  name="$(basename "$local_skill")"
  rm -rf "${HOME_DIR:?}/.hermes/skills/$name"
  cp -r "$local_skill" "$HOME_DIR/.hermes/skills/$name"
done

OV_VENV="$HOME_DIR/.openviking-venv"
uv venv "$OV_VENV" --python 3.12 || true
uv pip install --python "$OV_VENV/bin/python" 'openviking[local-embed]==0.4.13' 'openviking-sdk==0.1.7'
mkdir -p "$HOME_DIR/.openviking" && chmod 700 "$HOME_DIR/.openviking"
cp "$BASE_TEMPLATE_DIR/openviking/ovctl.py" "$HOME_DIR/.openviking/ovctl.py"
chmod 755 "$HOME_DIR/.openviking/ovctl.py"
cat > "$BIN_DIR/ovctl" <<SH
#!/usr/bin/env bash
set -euo pipefail
exec "$OV_VENV/bin/python" "$HOME_DIR/.openviking/ovctl.py" "\$@"
SH
chmod +x "$BIN_DIR/ovctl"

"$HERMES_VENV/bin/python" - "$HOME_DIR/.hermes/config.yaml" <<'PYEOF'
import sys, yaml, pathlib
p = pathlib.Path(sys.argv[1])
cfg = yaml.safe_load(p.read_text()) if p.exists() else None
cfg = cfg if isinstance(cfg, dict) else {}
mcp = cfg.get("mcp_servers")
mcp = mcp if isinstance(mcp, dict) else {}
mcp["openviking"] = {"url": "http://127.0.0.1:1933/mcp", "enabled": True}
cfg["mcp_servers"] = mcp
p.write_text(yaml.safe_dump(cfg, default_flow_style=False))
PYEOF

mkdir -p "$HOME_DIR/.hermes/calendar/inbox"
chmod 700 "$HOME_DIR/.hermes/calendar"
cp "$BASE_TEMPLATE_DIR/calendar/sync.py" "$HOME_DIR/.hermes/calendar/sync.py"
chmod 755 "$HOME_DIR/.hermes/calendar/sync.py"

mkdir -p "$HOME_DIR/.hermes/plugins"
for plugin in creative air-vault; do
  rm -rf "${HOME_DIR:?}/.hermes/plugins/$plugin"
  cp -r "$BASE_TEMPLATE_DIR/plugins/$plugin" "$HOME_DIR/.hermes/plugins/$plugin"
done
rm -rf "$HOME_DIR/.hermes/plugins/air-vault/tests"
sed -i '' '/^CREATIVE_PLUGIN_VERSION=/d' "$HOME_DIR/.hermes/.env"
echo "CREATIVE_PLUGIN_VERSION=$(python3 -c "import json;print(json.load(open('$BASE_TEMPLATE_DIR/plugins/creative/dashboard/manifest.json'))['version'])")" >> "$HOME_DIR/.hermes/.env"

cat > "$BIN_DIR/air-vault" <<SH
#!/usr/bin/env bash
set -euo pipefail
if [ -z "\${AIR_VAULT_KEY:-}" ] && [ -f "$HOME_DIR/.hermes/.env" ]; then
  AIR_VAULT_KEY="\$(grep -m1 '^AIR_VAULT_KEY=' "$HOME_DIR/.hermes/.env" | cut -d= -f2- || true)"
  export AIR_VAULT_KEY
fi
exec "$HERMES_VENV/bin/python" "$HOME_DIR/.hermes/plugins/air-vault/cli.py" "\$@"
SH
chmod +x "$BIN_DIR/air-vault"

cat > "$BIN_DIR/open-miniapp-card" <<SH
#!/usr/bin/env bash
set -euo pipefail
kind="\${1:?usage: open-miniapp-card <kind>}"
base="\$(grep -m1 '^OPENAI_BASE_URL=' "$HOME_DIR/.hermes/.env" | cut -d= -f2-)"
key="\$(grep -m1 '^OPENAI_API_KEY=' "$HOME_DIR/.hermes/.env" | cut -d= -f2-)"
exec curl -fsS -X POST "\${base%/api/gateway/v1}/api/cards/\${kind}" \\
  -H "Authorization: Bearer \$key"
SH
chmod +x "$BIN_DIR/open-miniapp-card"

"$HERMES_VENV/bin/python" - "$HOME_DIR/.hermes/config.yaml" <<'PYEOF'
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
p.write_text(yaml.safe_dump(cfg, default_flow_style=False))
PYEOF

# ── 9. SOUL.md identity — reuse the base blocks verbatim by extracting them
# from the ONE source of truth, so the agent's identity cannot drift. ────────
python3 - "$BASE_TEMPLATE_DIR/setup.sh" "$HOME_DIR/.hermes/SOUL.md" <<'PYEOF'
import re, sys, pathlib
setup = pathlib.Path(sys.argv[1]).read_text()
soul = pathlib.Path(sys.argv[2])
existing = soul.read_text() if soul.exists() else ""
blocks = re.findall(r"<<'EOF'\n(## .*?)\nEOF", setup, re.DOTALL)
identity = re.search(r"<<'EOF'\n(## You are air.*?)\nEOF", setup, re.DOTALL)
out = existing
if identity and "## You are air" not in out:
    out = identity.group(1) + "\n\n" + out
for block in blocks:
    header = block.splitlines()[0]
    if header not in out:
        out += "\n" + block + "\n"
soul.write_text(out)
PYEOF
# One darwin-specific delta: this computer is a Mac, not Linux.
python3 - "$HOME_DIR/.hermes/SOUL.md" "$HOME_DIR" <<'PYEOF'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
home = sys.argv[2].rstrip("/")
text = p.read_text()
text = text.replace(
    "You run on your own Linux computer with a graphical desktop",
    "You run on your own Mac (Apple silicon) with a graphical desktop",
)
# The send-file marker needs this Mac's real absolute home, not the Linux one.
text = text.replace("/home/user/.hermes/outbox/", f"{home}/.hermes/outbox/")
p.write_text(text)
PYEOF

# ── 10. C24 gate on the FINAL config ─────────────────────────────────────────
"$HERMES_VENV/bin/python" "$BASE_TEMPLATE_DIR/generate_platforms.py" \
  --hermes-repo "$HOME_DIR/hermes-agent" \
  --config "$HOME_DIR/.hermes/config.yaml" \
  --verify

# ── 11. launchd services (systemd equivalents; hermes-host has no macOS
# counterpart — Namespace ingress replaces the ascii tunnels). ───────────────
ENV_WRAP="$BIN_DIR/with-hermes-env"
cat > "$ENV_WRAP" <<SH
#!/usr/bin/env bash
set -euo pipefail
# Read KEY=VALUE lines verbatim — values like bcrypt hashes contain \$-runs
# that a shell source would expand.
while IFS= read -r line; do
  case "\$line" in ''|'#'*) continue;; esac
  export "\${line%%=*}=\${line#*=}"
done < "$HOME_DIR/.hermes/.env"
exec "\$@"
SH
chmod +x "$ENV_WRAP"

write_agent hermes-gateway "$ENV_WRAP" "$HERMES_VENV/bin/hermes" gateway
write_agent hermes-dashboard "$ENV_WRAP" "$HERMES_VENV/bin/hermes" dashboard --host 0.0.0.0 --port 9119 --no-open --skip-build
write_agent openviking "$ENV_WRAP" "$OV_VENV/bin/openviking-server" --config "$HOME_DIR/.openviking/ov.conf"

"$BIN_DIR/ovctl" ensure || echo "WARN: openviking ensure failed — deep memory degraded" >&2

# ── done: flip the bridge's health to ready ──────────────────────────────────
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$HOME_DIR/.hermes/.bootstrap-complete"
echo "macOS template setup complete."

# Namespace tears the instance down when its application workload exits, so
# the bootstrap process must stay resident for the life of the instance (the
# real services live in launchd agents).
exec tail -f /dev/null
