#!/usr/bin/env bash
# zap-light ("zap-VM") dev-box template setup.
#
# A Hyperlight-optimized execution box: the base air box plus a local
# sandboxed-exec lane for the three zap-light workloads — code generation
# runs, FFmpeg commands, and generative-media file workflows.
#
# Layers on top of infra/template/setup.sh (run that FIRST inside the
# template box). Hyperlight needs a hypervisor (/dev/kvm on Linux); when the
# host box has no KVM (ascii.dev boxes are themselves VMs without nested
# virt), the exec lane falls back to a plain-process sandbox and records the
# degraded mode in ~/.zap/capabilities.json so the control plane can route
# heavy isolation elsewhere (e.g. a Hetzner VPS running Firecracker).
set -euo pipefail

HOME_DIR="${HOME:-/home/user}"
ZAP_DIR="$HOME_DIR/.zap"
HYPERLIGHT_REPO="${HYPERLIGHT_REPO:-https://github.com/hyperlight-dev/hyperlight.git}"
# Pin deliberately; bump with a delta review like HERMES_REF.
HYPERLIGHT_REF="${HYPERLIGHT_REF:-main}"

# ── 0. Base template first ──────────────────────────────────────────────
if [ ! -f "$HOME_DIR/.hermes/.template-hermes-ref" ]; then
  echo "FATAL: run infra/template/setup.sh before the zap-light overlay" >&2
  exit 1
fi

mkdir -p "$ZAP_DIR" "$ZAP_DIR/media" "$ZAP_DIR/workflows" "$ZAP_DIR/runs"

# ── 1. Media toolchain (FFmpeg lane) ────────────────────────────────────
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ffmpeg imagemagick libvips-tools jq

# ── 2. Hypervisor capability probe ──────────────────────────────────────
KVM_AVAILABLE=false
if [ -e /dev/kvm ] && [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
  KVM_AVAILABLE=true
fi

# ── 3. Hyperlight host (only meaningful with KVM) ───────────────────────
# Hyperlight is a library, not a daemon: we build its Rust host examples so
# the box can spin function sandboxes in-process. Skipped without KVM — the
# fallback lane still works, just without micro-VM isolation.
if [ "$KVM_AVAILABLE" = true ]; then
  command -v cargo >/dev/null || {
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    . "$HOME_DIR/.cargo/env"
  }
  if [ ! -d "$ZAP_DIR/hyperlight/.git" ]; then
    git clone --depth 1 "$HYPERLIGHT_REPO" "$ZAP_DIR/hyperlight"
  fi
  git -C "$ZAP_DIR/hyperlight" fetch --depth 1 origin "$HYPERLIGHT_REF"
  git -C "$ZAP_DIR/hyperlight" checkout --force FETCH_HEAD
  (cd "$ZAP_DIR/hyperlight" && cargo build --release -p hyperlight-host)
fi

# ── 4. Capability manifest the control plane reads ──────────────────────
cat > "$ZAP_DIR/capabilities.json" <<EOF
{
  "template": "zap-light",
  "kvm": $KVM_AVAILABLE,
  "isolation": "$([ "$KVM_AVAILABLE" = true ] && echo hyperlight || echo process)",
  "lanes": ["codegen", "ffmpeg", "media-workflows"],
  "hyperlight_ref": "$HYPERLIGHT_REF"
}
EOF

# ── 5. zap-exec unit: local queue runner for zap runs ───────────────────
mkdir -p "$ZAP_DIR/bin"
cp "$(dirname "$0")/zap-exec-loop" "$ZAP_DIR/bin/zap-exec-loop"
chmod 755 "$ZAP_DIR/bin/zap-exec-loop"
sudo cp "$(dirname "$0")/zap-exec.service" /etc/systemd/system/zap-exec.service
sudo systemctl daemon-reload
sudo systemctl enable --now zap-exec.service

echo "zap-light overlay complete (kvm=$KVM_AVAILABLE)"
