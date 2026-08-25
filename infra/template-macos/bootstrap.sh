#!/usr/bin/env bash
# air 2.0 — macOS environment, first-boot bootstrap.
#
# The macos "template pointer" is the URL of THIS file: Namespace has no
# snapshot fork for native instances, so a fresh Apple-silicon Mac curls it on
# first boot (lib/namespace/client.ts createMacInstance) and builds itself.
# It only pins down where the real template lives, then hands over — keeping
# the curl-able part too small to drift:
#   1. clone the infra repo at a pinned ref
#   2. exec infra/template-macos/setup.sh from that checkout
#
# Per-instance env arrives from the control plane on the process environment:
# TENANT_ID, GATEWAY_TOKEN (C1), AIR_BRIDGE_TOKEN, AIR_BRIDGE_PORT.
set -euo pipefail

# Pinned like HERMES_REF: a floating branch would silently change what the
# macos environment is. Re-pin deliberately (see UPGRADE.md).
AIR_INFRA_REPO="${AIR_INFRA_REPO:-https://github.com/gratitude5dee/airv2.git}"
AIR_INFRA_REF="${AIR_INFRA_REF:-0a13b9e00a6e17f48bb9b4b6a1c68e78fff7cf40}"

INFRA_DIR="$HOME/.air-infra"
if [ ! -d "$INFRA_DIR/.git" ]; then
  git init "$INFRA_DIR"
  git -C "$INFRA_DIR" remote add origin "$AIR_INFRA_REPO"
fi
git -C "$INFRA_DIR" fetch --depth 1 origin "$AIR_INFRA_REF"
git -C "$INFRA_DIR" checkout --force FETCH_HEAD

exec bash "$INFRA_DIR/infra/template-macos/setup.sh"
