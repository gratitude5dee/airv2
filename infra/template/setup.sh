#!/usr/bin/env bash
# air 2.0 — M0 template box setup.
# Run ONCE inside the template Box (created with noEnv:false, ttlSeconds:null,
# size default 4 vCPU / 8 GB). User forks are created with noEnv:true.
set -euo pipefail

HERMES_REPO="${HERMES_REPO:-https://github.com/NousResearch/hermes-agent.git}"
HOME_DIR="${HOME:-/home/user}"

# ── 1. Hermes from source, with the extras the dashboard needs ──────────────
if [ ! -d "$HOME_DIR/hermes-agent" ]; then
  git clone --depth 1 "$HERMES_REPO" "$HOME_DIR/hermes-agent"
fi
cd "$HOME_DIR/hermes-agent"
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv --python 3.11 || true
uv pip install -e ".[all]"   # [all] covers web (FastAPI/Uvicorn) + pty

# ── 2. Build the dashboard SPA at template time ─────────────────────────────
# Otherwise every forked box shells out to npm on first launch.
uv run hermes dashboard --build-only 2>/dev/null || (
  cd hermes_cli/web && npm ci && npm run build
)
test -n "$(ls -A hermes_cli/web_dist 2>/dev/null)" || {
  echo "FATAL: hermes_cli/web_dist/ is empty — dashboard SPA did not build" >&2
  exit 1
}

# ── 3. Seed ~/.hermes/config.yaml ───────────────────────────────────────────
# approvals on; terminal.backend local (the Box IS the computer); model.base_url
# points at the gateway placeholder (rewritten per-fork by the control plane);
# every messaging platform explicitly disabled except api_server (C12).
mkdir -p "$HOME_DIR/.hermes"
cat > "$HOME_DIR/.hermes/config.yaml" <<'YAML'
approvals:
  enabled: true

terminal:
  backend: local

model:
  base_url: "https://GATEWAY_PLACEHOLDER/api/gateway/v1"

dashboard:
  auth:
    provider: basic

platforms:
  api_server:
    enabled: true
  bluebubbles: { enabled: false }
  telegram: { enabled: false }
  discord: { enabled: false }
  slack: { enabled: false }
  signal: { enabled: false }
  whatsapp: { enabled: false }
  whatsapp_cloud: { enabled: false }
  email: { enabled: false }
  sms: { enabled: false }
  matrix: { enabled: false }
  mattermost: { enabled: false }
  dingtalk: { enabled: false }
  feishu: { enabled: false }
  wecom: { enabled: false }
  weixin: { enabled: false }
  qqbot: { enabled: false }
  yuanbao: { enabled: false }
  webhook: { enabled: false }
  msgraph_webhook: { enabled: false }
  relay: { enabled: false }
YAML

# ── 4. systemd units — /etc is snapshotted, enabled units restart on resume ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo cp "$SCRIPT_DIR"/hermes-gateway.service /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/hermes-dashboard.service /etc/systemd/system/
sudo cp "$SCRIPT_DIR"/hermes-host.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hermes-gateway.service hermes-dashboard.service hermes-host.service
sudo systemctl start hermes-gateway.service hermes-dashboard.service hermes-host.service

echo "Template setup complete."
echo "Next (operator steps, per goal.md M0):"
echo "  1. Verify /health on 8642 and /api/health on 9119 via the hosted URLs."
echo "  2. Warm the template: stop, resume, let Hermes boot fully, stop again."
echo "  3. Record the box id as BOX_TEMPLATE_ID."
