#!/usr/bin/env bash
# air 2.0 — M0 template box setup.
# Run ONCE inside the template Box (created with noEnv:false, ttlSeconds:null,
# size default 4 vCPU / 8 GB). User forks are created with noEnv:true.
set -euo pipefail

HERMES_REPO="${HERMES_REPO:-https://github.com/NousResearch/hermes-agent.git}"
# V0: pinned Hermes revision (C24 depends on knowing exactly which snapshot the
# template runs). Tag v2026.8.31 == pyproject version 0.21.0 (2026-08-31).
# Re-pin deliberately with a delta review — never float back to main
# (goal.md §12.4).
HERMES_REF="${HERMES_REF:-29112bef099274229cadff79cdff7bf7b99c4b77}"
HOME_DIR="${HOME:-/home/user}"

# ── 1. Hermes from source at the pinned revision ────────────────────────
if [ ! -d "$HOME_DIR/hermes-agent/.git" ]; then
  # init+fetch instead of clone --branch: works for tags AND bare commit SHAs.
  git init "$HOME_DIR/hermes-agent"
  git -C "$HOME_DIR/hermes-agent" remote add origin "$HERMES_REPO"
fi
git -C "$HOME_DIR/hermes-agent" fetch --depth 1 origin "$HERMES_REF"
git -C "$HOME_DIR/hermes-agent" checkout --force FETCH_HEAD
RESOLVED_HERMES_SHA=$(git -C "$HOME_DIR/hermes-agent" rev-parse HEAD)
mkdir -p "$HOME_DIR/.hermes"
printf '%s\n' "$RESOLVED_HERMES_SHA" > "$HOME_DIR/.hermes/.template-hermes-ref"
cd "$HOME_DIR/hermes-agent"
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
# The hermes-* units exec ~/.local/bin/uv by absolute path; a base image that
# ships uv elsewhere (e.g. /usr/local/bin) still needs that path to resolve.
mkdir -p "$HOME_DIR/.local/bin"
[ -x "$HOME_DIR/.local/bin/uv" ] || ln -sfn "$(command -v uv || echo /usr/local/bin/uv)" "$HOME_DIR/.local/bin/uv"

# The venv lives OUTSIDE the git checkout: box archive/restore drops
# gitignored paths inside the repo (same reason web_dist is copied out), and
# `uv run`'s implicit sync would strip the [all] extras (aiohttp → api_server
# dies). So: persistent env at ~/.hermes-venv + UV_NO_SYNC everywhere.
HERMES_VENV="$HOME_DIR/.hermes-venv"
uv venv "$HERMES_VENV" --python 3.11 || true
UV_PROJECT_ENVIRONMENT="$HERMES_VENV" uv pip install -e ".[all]" --python "$HERMES_VENV/bin/python"
grep -q UV_NO_SYNC "$HOME_DIR/.bashrc" || {
  echo "export UV_NO_SYNC=1" >> "$HOME_DIR/.bashrc"
  echo "export UV_PROJECT_ENVIRONMENT=$HERMES_VENV" >> "$HOME_DIR/.bashrc"
}
grep -q UV_NO_SYNC /etc/environment || {
  echo "UV_NO_SYNC=1" | sudo tee -a /etc/environment >/dev/null
  echo "UV_PROJECT_ENVIRONMENT=$HERMES_VENV" | sudo tee -a /etc/environment >/dev/null
}

# ── 2. Build the dashboard SPA at template time ─────────────────────────────
# Otherwise every forked box shells out to npm on first launch.
# web/vite.config.ts builds into ../hermes_cli/web_dist.
# Node 24 via nvm: the box's system node (v20) fails hermes-agent's engine
# check, and nvm-installed versions live in $HOME so they survive archive.
export NVM_DIR="$HOME_DIR/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] || { curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash; }
# nvm.sh's auto-use returns non-zero when no default alias exists yet, which
# set -e would turn fatal; the install below creates the alias.
. "$NVM_DIR/nvm.sh" || true
nvm install 24 && nvm alias default 24

(cd web && npm ci && npm run build)
test -n "$(ls -A hermes_cli/web_dist 2>/dev/null)" || {
  echo "FATAL: hermes_cli/web_dist/ is empty — dashboard SPA did not build" >&2
  exit 1
}

# ── 3. Seed ~/.hermes/config.yaml ───────────────────────────────────────────
# approvals on; terminal.backend local (the Box IS the computer); model.base_url
# points at the gateway placeholder (rewritten per-fork by the control plane);
# every messaging platform explicitly disabled except api_server (C12); the
# platforms block is GENERATED from the pinned snapshot, never hand-written
# (C24) — an upstream adapter (photon above all) must never silently open a
# second door into the agent.
mkdir -p "$HOME_DIR/.hermes"
cat > "$HOME_DIR/.hermes/config.yaml" <<'YAML'
approvals:
  mode: "smart"
  # V5 social gate: publishing in the human's name always pauses the run
  # (waiting_for_approval) so the Needs-you social_post card can resume it
  # via /v1/runs/{id}/approval with the human's approve/dismiss.
  smart_policy: "ALWAYS ESCALATE any command or browser action that publishes text publicly in the human's name on a social platform (posting, commenting, or replying). Liking/reacting under an enabled standing rule does not need escalation."

terminal:
  backend: "local"

# MA9.1: persistent memory on — ~/.hermes/memories/{MEMORY.md,USER.md} live in
# this box's filesystem (I1/C4: memory is content, it never leaves for shared
# Postgres). write_approval stays false to match the box's smart-approvals
# posture: memory writes are local file edits, not public actions, so they do
# not gate; the smart_policy above still escalates anything that publishes.
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: false

# The box IS the computer: launch the agent browser headed on the box's X
# display so the human can watch/act via the desktop stream (computer relay).
# backend is pinned explicitly (V0 task 3b): "off" = the built-in browser_*
# tools over the baked agent-browser CLI — the behavior v2 shipped — rather
# than inheriting 0.20.x's browser_exec-when-CLI-present default.
browser:
  headed: true
  backend: "off"

# Web three-job split: web_search is discovery, web_extract reads pages with
# a deterministic head+tail budget (the extract cache under ~/.hermes/cache/web
# is shared across subagent processes), and the browser is for interaction
# only. Backends stay empty in the template — no provider key is ever baked
# into the box (C2). The control plane fills search_backend/extract_backend
# when the user's vault holds a matching provider key (lib/vault/managers.ts);
# with no key, the keyless free-tier ring serves both jobs.
web:
  search_backend: ""
  extract_backend: ""
  extract_char_limit: 15000
  keyless_fallback: true
  keyless_rescue: true

# Delegated children (research/search/browse fan-out) run on the abstract
# "fast" tier — the gateway resolves it server-side and honors it as a
# downgrade-only lane — while this parent stays on the box default below.
# provider stays unset so children inherit the box's custom gateway
# credentials; depth stays 1 (raising it multiplies per-leaf runtime — set a
# non-zero child_timeout_seconds before ever enabling depth 2).
delegation:
  model: "fast"
  max_concurrent_children: 4
  max_spawn_depth: 1

model:
  default: "balanced"
  provider: "custom"
  base_url: "https://GATEWAY_PLACEHOLDER/api/gateway/v1"

# V7 substrate: named profiles serve under /p/<name>/ with per-profile keys.
gateway:
  multiplex_profiles: true
YAML

# ── 3a. C24: generate the platform-disable list from the pinned snapshot ────
# Enumerate gateway.config.Platform ∪ plugins/platforms/*/ and append
# `enabled: false` for every adapter except api_server. Build FAILS if
# generation fails (set -e) or produces an implausibly small set.
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$HERMES_VENV/bin/python" "$TEMPLATE_DIR/generate_platforms.py" \
  --hermes-repo "$HOME_DIR/hermes-agent" \
  --config "$HOME_DIR/.hermes/config.yaml"

# ── 3b. Seed ~/.hermes/.env with template-time secrets ──────────────────────
# API_SERVER_KEY and the dashboard basic-auth credentials are per-box secrets
# regenerated by the control plane at fork; these are template placeholders
# strong enough to boot and warm the services.
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
DISPLAY=:0
# agent-browser parses AGENT_BROWSER_ARGS comma-separated (space-separated
# values are also whitespace-split by systemd EnvironmentFile= loading).
# Keep it minimal: overriding --remote-debugging-port/--user-data-dir makes
# Chrome write DevToolsActivePort to the overridden profile dir, the daemon
# never sees its port, and every CLI call hangs. air-vault discovers the
# CDP port from the daemon's DevToolsActivePort file instead.
AGENT_BROWSER_ARGS=--no-sandbox,--disable-dev-shm-usage
ENV
chmod 600 "$HOME_DIR/.hermes/.env"

# ── 3b2. Browser runtime for the computer relay ─────────────────────────────
# Hermes' browser tool shells out to the agent-browser CLI, which needs
# Node >= 22. Both live under $HOME so they survive box archive/restore.
# Chromium runs headed on :0 with --no-sandbox (containerized box).
HERMES_NODE="$HOME_DIR/.hermes/node"
if [ ! -x "$HERMES_NODE/bin/node" ]; then
  curl -fsSLo /tmp/node22.tar.xz https://nodejs.org/dist/v22.22.0/node-v22.22.0-linux-x64.tar.xz
  mkdir -p "$HERMES_NODE"
  tar -xJf /tmp/node22.tar.xz -C "$HERMES_NODE" --strip-components=1
  rm -f /tmp/node22.tar.xz
fi
export PATH="$HERMES_NODE/bin:$PATH"
npm install -g agent-browser --no-audit --no-fund
agent-browser install   # downloads Chrome for Testing into ~/.agent-browser

# air-vault type talks CDP to the daemon's Chrome via its DevToolsActivePort
# file (C19); no fixed port or profile override is needed.

# ── 3b2b. Browser Use CLI 3.0: script-driven control of the same Chrome ─────
# browser-use pipes Python (Browser Harness) into a browser over CDP. The
# box-browser-use wrapper attaches it to the SAME headed daemon Chrome the
# browser_* tools and air-vault use — one browser, one session state, so the
# human can still watch/act via the desktop stream and every purchase keeps
# the stop-before-submission flow. Pinned version (C24); uv tool installs
# into ~/.local/bin, which survives box archive/restore.
uv tool install --python 3.12 'browser-use==0.13.8'

# ── 3b2c. Stripe Link CLI: one-time-use payment credentials, owner-approved ──
# link-cli pairs this box as a device on the OWNER's Link wallet (they
# approve from their Link app during onboarding). Credentials live only in
# ~/.hermes/link/ (600/700, snapshotted); every spend request still needs
# the owner's in-app approval, and the human always clicks the final Pay
# button. Pinned version (C24); npm -g lands in the hermes Node prefix.
npm install -g @stripe/link-cli@0.13.1 --no-audit --no-fund
mkdir -p "$HOME_DIR/.hermes/link" && chmod 700 "$HOME_DIR/.hermes/link"

# ── 3b2d. 1Password CLI (pinned, checksum-verified) ─────────────────────────
# Opt-in only: the binary ships with every box but reads nothing until the
# owner connects a 1Password account from onboarding/Settings, which writes
# OP_SERVICE_ACCOUNT_TOKEN into ~/.hermes/.env. Without that token
# `air-vault op-fill` refuses and the agent never invokes `op`. The template
# carries NO 1Password credential.
OP_VERSION="2.35.0"
OP_SHA256="4457ade59850b852c64c77164235b34dd0b984ef7826eb0ccd32f1fd78a2ceb7"
curl -fsSL -o /tmp/op.zip \
  "https://cache.agilebits.com/dist/1P/op2/pkg/v${OP_VERSION}/op_linux_amd64_v${OP_VERSION}.zip"
echo "${OP_SHA256}  /tmp/op.zip" | sha256sum -c -
rm -rf /tmp/op-dist && python3 -m zipfile -e /tmp/op.zip /tmp/op-dist
sudo install -m 755 /tmp/op-dist/op /usr/local/bin/op
rm -rf /tmp/op.zip /tmp/op-dist
op --version

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

# Make the CLI resolvable by the systemd services (they inherit systemd's
# default PATH and only load ~/.hermes/.env, which does no $-expansion) and
# by the agent's local terminal backend.
sed -i '/^PATH=/d' "$HOME_DIR/.hermes/.env"
echo "PATH=$HERMES_NODE/bin:$HOME_DIR/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" >> "$HOME_DIR/.hermes/.env"
grep -q 'hermes/node/bin' "$HOME_DIR/.bashrc" || \
  echo "export PATH=\"$HERMES_NODE/bin:\$PATH\"" >> "$HOME_DIR/.bashrc"

# ── 3b3. Daytona CLI + MCP: on-demand throwaway code sandboxes ───────────────
# The Box stays the agent's durable home; Daytona sandboxes are ephemeral
# (create → run → destroy) for risky/experimental code. The CLI binary lives
# in /usr/local/bin (snapshotted). The template carries NO Daytona credential:
# the control plane mints a per-user child key at provision time and writes it
# as DAYTONA_API_KEY into ~/.hermes/.env (lib/provisioning/daytona.ts) — the
# same lane as GATEWAY_TOKEN and the AgentMail draft-only key. Without that
# key the CLI/MCP is unauthenticated and the sandbox lane stays disabled.
# The MCP server is stdio: `daytona mcp start`.
# Download to a temp path and mv: overwriting in place fails with ETXTBSY
# when a daytona process (e.g. the MCP server) is already running.
sudo curl -sfL https://github.com/daytona/clients/releases/latest/download/daytona-linux-amd64 -o /tmp/daytona.dl
sudo chmod +x /tmp/daytona.dl
sudo mv /tmp/daytona.dl /usr/local/bin/daytona
# Scrub any login profile from earlier template generations — a profile in
# ~/.daytona would be a shared org key inherited by every fork (P1-11).
rm -rf "$HOME_DIR/.daytona"
printf 'y\n' | "$HERMES_VENV/bin/hermes" mcp add daytona --command /usr/local/bin/daytona --args mcp start \
  || echo "WARN: daytona mcp add failed" >&2

# ── 3c. Preinstall base skills into ~/.hermes/skills ────────────────────────
# On top of the bundled library; forks inherit these so provisioning doesn't
# pay the install cost per user. Failures warn but don't abort the template.
# Identifiers live in base-skills.txt (pinned from real `hermes skills search`
# results, never guessed) and are mirrored in BASE_SKILLS
# (apps/web/lib/skills/hub.ts) so provisioning re-asserts them per fork. The
# eval-test set (V0 web latency) rides along so the agent-suite can exercise
# them without per-box installs.
# Mail: official/email/agentmail is the legacy AgentMail path
# (MAIL_PROVIDER=agentmail); the native wzrdmail skill is not a hub skill and
# is baked from skills/wzrdmail in the local-skills loop below. Provisioning
# enables exactly one mail MCP (wzrdmail or agentmail) per box, so having both
# skills on the image is harmless during the cutover.
# The skills that actually landed are recorded in ~/.hermes/.template-skills
# by skills-manifest.py (lockfile + SKILL.md on disk, not the CLI exit code,
# which is 0 even when nothing was installed); provisioning re-asserts only
# the identifiers missing from that manifest.
grep -Ev '^\s*(#|$)' "$TEMPLATE_DIR/base-skills.txt" | while read -r skill _options; do
  "$HERMES_VENV/bin/hermes" skills install "$skill" --yes </dev/null \
    || echo "WARN: base skill $skill install failed" >&2
done
python3 "$TEMPLATE_DIR/skills-manifest.py" "$HOME_DIR" "$TEMPLATE_DIR/base-skills.txt"

# Bake local skills shipped with this template (e.g. the computer relay,
# which teaches the agent to send its human a live screen card for logins).
mkdir -p "$HOME_DIR/.hermes/skills"
for local_skill in "$TEMPLATE_DIR"/skills/*/; do
  name="$(basename "$local_skill")"
  rm -rf "$HOME_DIR/.hermes/skills/$name"
  cp -r "$local_skill" "$HOME_DIR/.hermes/skills/$name"
done

# ── 3c2. OpenViking deep memory (docs/memory-upgrade.md, layer 2) ───────────
# A loopback-only semantic memory server per box. Its own venv (the hermes
# venv is pinned to the agent's lockstep deps); pinned versions (C24). The
# workspace lives under ~/.openviking so memory snapshots/restores with the
# box (I1/C4). Embeddings use OpenViking's built-in local model — a shared
# or hosted vector store would move memory content off-box.
OV_VENV="$HOME_DIR/.openviking-venv"
uv venv "$OV_VENV" --python 3.12 || true
# [local-embed] pulls llama-cpp-python (no wheel — builds from source, so the
# toolchain below); without it the server refuses to start local embeddings.
# GGML_NATIVE=OFF is required: the template builds on one machine but the
# snapshot boots on arbitrary VM CPUs, and a -march=native ggml build SIGILLs
# on any host missing the build machine's instruction set (openviking.service
# crash-looped with status=4/ILL on EPYC-Rome until rebuilt portably).
sudo apt-get install -y --no-install-recommends cmake build-essential
CMAKE_ARGS="-DGGML_NATIVE=OFF" uv pip install --python "$OV_VENV/bin/python" --no-binary llama-cpp-python 'openviking[local-embed]==0.4.16' 'openviking-sdk==0.1.7'
mkdir -p "$HOME_DIR/.openviking" && chmod 700 "$HOME_DIR/.openviking"
cp "$TEMPLATE_DIR/openviking/ovctl.py" "$HOME_DIR/.openviking/ovctl.py"
chmod 755 "$HOME_DIR/.openviking/ovctl.py"

# The control plane drives ingest/status through this one named binary over
# the box command API (same pattern as air-vault / open-miniapp-card).
sudo tee /usr/local/bin/ovctl >/dev/null <<SH
#!/usr/bin/env bash
set -euo pipefail
exec "$OV_VENV/bin/python" "$HOME_DIR/.openviking/ovctl.py" "\$@"
SH
sudo chmod +x /usr/local/bin/ovctl

# Register the MCP server: recall (find/search/read) and persist
# (remember/add_resource) become Hermes tools in the shared air-main session.
python3 - "$HOME_DIR/.hermes/config.yaml" <<'PYEOF'
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

# ── 3c3. Local task router (advisory shadow classifier, loopback :1917) ─────
# A small GGUF model classifies messages into {tier, tools, needs_approval}
# proposals. ADVISORY ONLY: the control plane stays the sole authorizer —
# nothing consumes this output authoritatively yet (shadow mode). Reuses the
# OpenViking venv's portable llama-cpp-python build (GGML_NATIVE=OFF above),
# so no new toolchain enters the box. Decisions log to ~/.taskrouter (box
# filesystem, never shared Postgres). Pinned model (C24); the download is
# best-effort — without the model the service serves deterministic
# heuristics from the same closed enums.
mkdir -p "$HOME_DIR/.taskrouter" && chmod 700 "$HOME_DIR/.taskrouter"
cp "$TEMPLATE_DIR/taskrouter/taskrouter.py" "$HOME_DIR/.taskrouter/taskrouter.py"
chmod 755 "$HOME_DIR/.taskrouter/taskrouter.py"
curl -fsSL -o "$HOME_DIR/.taskrouter/model.gguf" \
  "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf" \
  || { echo "WARN: task-router model download failed — router runs heuristics only" >&2; rm -f "$HOME_DIR/.taskrouter/model.gguf"; }

# ── 3c4. Opt-in connectivity: Tailscale + Cotal (installed, NEVER enabled) ──
# Tailscale: binaries + a DISABLED unit. Only the owner's Settings opt-in
# (apps/web/lib/box/tailscale.ts) ever starts it, joining the USER'S own
# tailnet with the user's own auth key — never a platform tailnet (I1).
# Pinned version (C24).
TS_VERSION=1.82.0
curl -fsSL -o /tmp/tailscale.tgz "https://pkgs.tailscale.com/stable/tailscale_${TS_VERSION}_amd64.tgz" \
  && tar -xzf /tmp/tailscale.tgz -C /tmp \
  && sudo install -m 755 "/tmp/tailscale_${TS_VERSION}_amd64/tailscale" "/tmp/tailscale_${TS_VERSION}_amd64/tailscaled" /usr/local/bin/ \
  && rm -rf /tmp/tailscale.tgz "/tmp/tailscale_${TS_VERSION}_amd64" \
  || echo "WARN: tailscale install failed — opt-in tailnet unavailable" >&2

# Cotal: a loopback NATS agent-session bus (single-tenant by construction —
# it never leaves the box). Preinstalled so the owner's Settings opt-in
# (apps/web/lib/box/cotal.ts) can start it without a per-box npm install.
# Pinned version (C24). Not started here.
npm install -g cotal-ai@0.33.1 --no-audit --no-fund \
  || echo "WARN: cotal preinstall failed — opt-in agent mesh unavailable" >&2

# ── 3d. Calendar spine (V3): the box-resident event store + sync pipeline ──
# Events live here, never in shared Postgres (C4). sources.json (written by
# the control plane on connect) holds source credentials, mode 600.
mkdir -p "$HOME_DIR/.hermes/calendar/inbox"
chmod 700 "$HOME_DIR/.hermes/calendar"
cp "$TEMPLATE_DIR/calendar/sync.py" "$HOME_DIR/.hermes/calendar/sync.py"
chmod 755 "$HOME_DIR/.hermes/calendar/sync.py"

# One versioned instruction block for new and existing boxes (TC-19).
python3 "$TEMPLATE_DIR/manage-soul.py" "$HOME_DIR/.hermes/SOUL.md"

# Copy the built SPA outside the git checkout: box archive/restore does not
# preserve gitignored build output inside the repo, so the dashboard serves
# from ~/.hermes/web_dist (HERMES_WEB_DIST) instead.
rm -rf "$HOME_DIR/.hermes/web_dist"
cp -r "$HOME_DIR/hermes-agent/hermes_cli/web_dist" "$HOME_DIR/.hermes/web_dist"
echo "HERMES_WEB_DIST=$HOME_DIR/.hermes/web_dist" >> "$HOME_DIR/.hermes/.env"

# ── 3d. Bake the creative plugin into the template (CM1 task 7 / CC9) ────────
# Plugin API routes mount once at dashboard startup; a rescan will not pick up
# a new plugin_api.py — a plugin version bump means a template rebuild plus a
# documented re-fork or restart window (docs/creative-plugin.md).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$HOME_DIR/.hermes/plugins"
rm -rf "$HOME_DIR/.hermes/plugins/creative"
cp -r "$SCRIPT_DIR/plugins/creative" "$HOME_DIR/.hermes/plugins/creative"
sed -i '/^CREATIVE_PLUGIN_VERSION=/d' "$HOME_DIR/.hermes/.env"
echo "CREATIVE_PLUGIN_VERSION=$(python3 -c "import json;print(json.load(open('$SCRIPT_DIR/plugins/creative/dashboard/manifest.json'))['version'])")" >> "$HOME_DIR/.hermes/.env"
# ── 3d2. Bake the air-vault plugin (V1 / C18) ────────────────────────────────
# Encrypted store + air-vault CLI + the air_vault mapped secret source. The
# store key (AIR_VAULT_KEY) is minted per-fork by the control plane; the
# template ships only code, never vault data. Plugin dir name uses a dash
# (matches the repo path); Hermes imports it under a sanitized module name,
# and the plugin.yaml name / secret-source name is air_vault.
rm -rf "$HOME_DIR/.hermes/plugins/air-vault"
cp -r "$SCRIPT_DIR/plugins/air-vault" "$HOME_DIR/.hermes/plugins/air-vault"
rm -rf "$HOME_DIR/.hermes/plugins/air-vault/tests"
# The CLI is invoked by the control plane as plain `air-vault ...` over the
# box command API.
# It reads ONLY AIR_VAULT_KEY out of ~/.hermes/.env (never `source`s it —
# other values could contain shell metacharacters).
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

# open-miniapp-card <kind>: the one-command card send the open-miniapp skill
# points at. Wrapping the curl in a named binary keeps the agent on the
# terminal tool (a simple command name) instead of drifting into
# execute_code, which stalls on an approval that never comes.
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

# air-create <new|build|qa|drop|status|publish>: the create-miniapp skill's CLI (V11 §9.5).
# Same reasoning — a plain command name keeps the agent on the terminal tool.
chmod +x "$HOME_DIR/.hermes/skills/create-miniapp/scripts/air-create"
sudo ln -sf "$HOME_DIR/.hermes/skills/create-miniapp/scripts/air-create" /usr/local/bin/air-create

# User plugins are opt-in: the dashboard only imports a user plugin's backend
# (plugin_api.py) when its name is in the plugins.enabled allow-list in
# ~/.hermes/config.yaml (GHSA-mcfc-hp25-cjv7). air_vault joins the allow-list
# and its secret source is seeded enabled (fetch degrades to NOT_CONFIGURED
# until provisioning mints AIR_VAULT_KEY).
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
p.write_text(yaml.safe_dump(cfg, default_flow_style=False))
PYEOF

# ── 3e. C24 gate: the build fails if any platform but api_server is enabled ──
# Re-checks the FINAL config (after every rewrite above) against the same
# enum ∪ plugin-dir ∪ registered-name union the generator used.
"$HERMES_VENV/bin/python" "$TEMPLATE_DIR/generate_platforms.py" \
  --hermes-repo "$HOME_DIR/hermes-agent" \
  --config "$HOME_DIR/.hermes/config.yaml" \
  --verify

# ── 3c5. Learning plane (goal.md V10 §7): air-learningd + learningctl ──────
# Signed template-owned code goes under /opt/air/learning (read-only to the
# agent); private learning state lives in ~/.hermes/learning and never leaves
# the box (L1). The daemon exposes a Unix socket only — no port, no tunnel,
# no provider key. Stdlib-only in V10 M1 (C24: no new toolchain). The HUD and
# Harbor pins in pyproject.toml are declared for M5/M6 and NOT installed here.
sudo mkdir -p /opt/air/learning
sudo cp -r "$TEMPLATE_DIR/learning/air_learning" /opt/air/learning/
sudo cp "$TEMPLATE_DIR/learning/pyproject.toml" /opt/air/learning/
sudo chmod -R a+rX /opt/air/learning
sudo install -m 755 "$TEMPLATE_DIR/learning/learningctl.py" /usr/local/bin/learningctl
mkdir -p "$HOME_DIR/.hermes/learning" && chmod 700 "$HOME_DIR/.hermes/learning"

# ── 3z. .boxignore — keep regenerable caches out of every snapshot ─────────
# Box snapshots /home/user every minute; package caches only slow captures
# and restores down. Only caches that rebuild themselves on demand go here —
# never tool installs (e.g. ~/.cache/ms-playwright holds real browsers).
cat > "$HOME_DIR/.boxignore" <<'EOF'
.npm/_cacache/
.cache/pip/
.cache/uv/
.hermes/cache/
.openviking/data/tmp/
EOF

# ── 4. systemd units — /etc is snapshotted, enabled units restart on resume ──
# Every unit the box runs is also started here: a Tenki template is a memory
# snapshot of this VM, so a fork never boots and only what is already running
# is running in the box.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo cp "$SCRIPT_DIR"/hermes-gateway.service /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/hermes-dashboard.service /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/hermes-host.service /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/hermes-sidecar-owner.service /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/hermes-sidecar-owner.timer /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/openviking.service /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/openviking-index.service "$SCRIPT_DIR"/openviking-index.timer /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/taskrouter.service /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/learning/systemd/air-learningd.service /etc/systemd/system/
# tailscaled.service is installed but NEVER enabled here — the owner's
# Settings opt-in is the only thing that starts it (I3 stays intact).
sudo cp "$SCRIPT_DIR"/tailscaled.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openviking-index.timer
sudo systemctl enable hermes-gateway.service hermes-dashboard.service hermes-host.service hermes-sidecar-owner.timer openviking.service taskrouter.service air-learningd.service
sudo systemctl start hermes-gateway.service hermes-dashboard.service hermes-host.service hermes-sidecar-owner.timer taskrouter.service air-learningd.service

# Render ov.conf (template stage: no gateway token yet → VLM block omitted;
# the first post-provision `ovctl ensure` re-renders with the per-fork
# gateway credentials) and start the server. Best effort — a broken deep
# memory layer must never fail the template build (graceful degradation is
# the acceptance posture in docs/memory-upgrade.md).
ovctl ensure || echo "WARN: openviking ensure failed — deep memory degraded" >&2

# Release identity (written by release.sh into the artifact). A build from a
# working tree has none, and must not leave a stale marker behind.
if [ -f "$TEMPLATE_DIR/RELEASE" ]; then
  cp "$TEMPLATE_DIR/RELEASE" "$HOME_DIR/.hermes/.template-release"
else
  rm -f "$HOME_DIR/.hermes/.template-release"
fi

echo "Template setup complete."
echo "Next (operator steps, per goal.md M0):"
echo "  1. Verify /health on 8642 and /api/health on 9119 via the hosted URLs."
echo "  2. Warm the template: stop, resume, let Hermes boot fully, stop again."
echo "  3. Record the box id as BOX_TEMPLATE_ID."
