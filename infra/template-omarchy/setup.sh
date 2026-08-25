#!/usr/bin/env bash
# air 2.0 — Omarchy (Arch Linux + Hyprland) template, built ON an ascii.dev box.
#
# This is an OVERLAY, not a fork of infra/template/setup.sh: it runs the Ubuntu
# template's setup.sh verbatim and then adds a real Arch userland with the
# Omarchy desktop on top. Hermes, the venv, the plugins, the skills, the
# calendar spine, SOUL.md and the C24 platform gate therefore cannot drift
# between the two environments — there is exactly one copy of them.
#
# Why an overlay and not an Arch base image: `POST /boxes` has no OS selector,
# so every box is the same Ubuntu x86_64 image. What CAN be Arch is the
# userland: this script pacstraps an Arch root at /opt/arch (real pacman, real
# yay/AUR, Omarchy's own package manifest and Hyprland config) sharing
# /home/user with the host, and runs the Omarchy desktop inside it.
#
# The desktop, and why DISPLAY becomes :1
#   The box already serves an X display :0 (that is what `GET /boxes/{id}/
#   desktop` streams). Hyprland runs nested on it (WLR_BACKENDS=x11), so the
#   whole Omarchy desktop appears inside that existing stream — no second VNC
#   stack, and the control plane's live-screen lane keeps working untouched.
#   Hyprland's own Xwayland then owns display :1, which is where the agent's
#   browser goes; /tmp is shared with the Arch root, so the host's baked
#   agent-browser Chrome connects to it over /tmp/.X11-unix/X1 unchanged.
#
# Usage (operator, on a fresh box — see UPGRADE.md):
#   copy infra/ to the box, then: bash infra/template-omarchy/setup.sh
set -euo pipefail

HOME_DIR="${HOME:-/home/user}"
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_TEMPLATE_DIR="${BASE_TEMPLATE_DIR:-$(cd "$TEMPLATE_DIR/../template" && pwd)}"
ENV_FILE="$HOME_DIR/.hermes/.env"

# The Arch root. /opt (not $HOME) because it is template content, not user
# state: it must not be part of the archive/restore of ~/.hermes.
ARCH_ROOT="${ARCH_ROOT:-/opt/arch}"
# Pinned like every other dependency here (C24): a moving "latest" bootstrap
# tarball would silently change what an Omarchy box is.
ARCH_BOOTSTRAP_DATE="${ARCH_BOOTSTRAP_DATE:-2026.08.01}"
ARCH_BOOTSTRAP_URL="${ARCH_BOOTSTRAP_URL:-https://archive.archlinux.org/iso/$ARCH_BOOTSTRAP_DATE/archlinux-bootstrap-$ARCH_BOOTSTRAP_DATE-x86_64.tar.zst}"
ARCH_MIRROR="${ARCH_MIRROR:-https://geo.mirror.pkgbuild.com/\$repo/os/\$arch}"
OMARCHY_REPO="${OMARCHY_REPO:-https://github.com/gratitude5dee/omarchy.git}"
OMARCHY_REF="${OMARCHY_REF:-43bfe9b9d82ba650b5b80eef79e94776790801c9}"
# The Omarchy desktop's Xwayland display, and therefore the agent's browser's.
OMARCHY_DISPLAY="${OMARCHY_DISPLAY:-:1}"

# ── 1. The shared baseline: Hermes, venv, plugins, skills, calendar, SOUL,
# services, C24 gate. Byte-identical to the Ubuntu environment. ─────────────
[ -x "$BASE_TEMPLATE_DIR/setup.sh" ] || [ -f "$BASE_TEMPLATE_DIR/setup.sh" ] || {
  echo "FATAL: $BASE_TEMPLATE_DIR/setup.sh not found — copy all of infra/ to the box" >&2
  exit 1
}
bash "$BASE_TEMPLATE_DIR/setup.sh"

# ── 2. Arch userland at $ARCH_ROOT ──────────────────────────────────────────
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y zstd

if [ ! -x "$ARCH_ROOT/usr/bin/pacman" ]; then
  curl -fsSLo /tmp/arch-bootstrap.tar.zst "$ARCH_BOOTSTRAP_URL"
  sudo mkdir -p "$ARCH_ROOT"
  # The tarball unpacks into root.x86_64/; --strip-components lands it directly.
  sudo tar -I zstd -xf /tmp/arch-bootstrap.tar.zst -C "$ARCH_ROOT" \
    --strip-components=1 --numeric-owner
  rm -f /tmp/arch-bootstrap.tar.zst
fi

echo "Server = $ARCH_MIRROR" | sudo tee "$ARCH_ROOT/etc/pacman.d/mirrorlist" >/dev/null
sudo cp /etc/resolv.conf "$ARCH_ROOT/etc/resolv.conf"
printf 'en_US.UTF-8 UTF-8\n' | sudo tee "$ARCH_ROOT/etc/locale.gen" >/dev/null

# ── 2a. Enter/leave the Arch root ───────────────────────────────────────────
# The bind mounts make the Arch userland the SAME machine as the host, not a
# separate one: same /home/user (so every ~/.hermes path the control plane
# knows is the same file), same /tmp (so the X sockets are shared), same
# /dev+/run (so the desktop and the browser can talk to the display).
sudo install -m 755 /dev/stdin /usr/local/bin/arch-mount <<'SH'
#!/usr/bin/env bash
# Bind the host into the Arch root. Idempotent; run by arch-root.service.
set -euo pipefail
ARCH_ROOT="${ARCH_ROOT:-/opt/arch}"
mountpoint -q "$ARCH_ROOT/proc" || mount -t proc proc "$ARCH_ROOT/proc"
mountpoint -q "$ARCH_ROOT/sys"  || mount --rbind /sys "$ARCH_ROOT/sys"
for dir in /dev /run /tmp /home/user; do
  target="$ARCH_ROOT$dir"
  mkdir -p "$target"
  mountpoint -q "$target" || mount --rbind "$dir" "$target"
done
SH

sudo install -m 755 /dev/stdin /usr/local/bin/arch-run <<SH
#!/usr/bin/env bash
# Run a shell line in the Arch userland as the box user (uid 1000), with the
# environment the desktop and the agent's tools expect. This is the ONLY entry
# point: pacman, yay, omarchy-* and the Hyprland session all go through it.
#   arch-run 'pacman -Qi hyprland'
set -euo pipefail
cmd="\${1:?usage: arch-run <shell line>}"
exec sudo chroot "$ARCH_ROOT" /usr/bin/setpriv \\
  --reuid=1000 --regid=1000 --init-groups \\
  /usr/bin/env -i \\
  HOME=/home/user USER=user LOGNAME=user TERM="\${TERM:-xterm-256color}" \\
  LANG=en_US.UTF-8 \\
  PATH=/usr/local/sbin:/usr/local/bin:/usr/bin:/bin \\
  XDG_RUNTIME_DIR=/run/user/1000 XDG_SESSION_TYPE=wayland \\
  OMARCHY_PATH=/usr/share/omarchy \\
  DISPLAY="\${DISPLAY:-:0}" WAYLAND_DISPLAY="\${WAYLAND_DISPLAY:-wayland-1}" \\
  WLR_BACKENDS="\${WLR_BACKENDS:-}" \\
  /bin/bash -lc "\$cmd"
SH

# root shell inside the chroot, for the build steps below only.
arch_root_run() {
  sudo chroot "$ARCH_ROOT" /usr/bin/env -i \
    HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/bin:/bin \
    LANG=en_US.UTF-8 /bin/bash -lc "$1"
}

sudo ARCH_ROOT="$ARCH_ROOT" /usr/local/bin/arch-mount

# ── 2b. Packages, the way Omarchy installs them ─────────────────────────────
# pacman for the repo packages (bin/omarchy-pkg-install) and yay for the AUR
# ones (bin/omarchy-pkg-aur-install). packages.omarchy is Omarchy's own
# install/omarchy-base.packages minus what only exists on real hardware.
arch_root_run 'pacman-key --init && pacman-key --populate archlinux'
arch_root_run 'locale-gen'
arch_root_run 'pacman -Syu --noconfirm --needed base-devel git sudo'
arch_root_run "id -u user >/dev/null 2>&1 || useradd -u 1000 -M -d /home/user -s /bin/bash user"
arch_root_run "printf 'user ALL=(ALL) NOPASSWD: ALL\n' > /etc/sudoers.d/user && chmod 0440 /etc/sudoers.d/user"

sudo cp "$TEMPLATE_DIR/packages.omarchy" "$ARCH_ROOT/tmp/packages.omarchy"
arch_root_run "pacman -Syu --noconfirm --needed \$(grep -v '^[[:space:]]*\(#\|\$\)' /tmp/packages.omarchy)"

# yay, built as a normal user (makepkg refuses root) exactly as Omarchy's
# AUR helper install does.
arch-run 'command -v yay >/dev/null || (rm -rf /tmp/yay-bin && git clone --depth 1 https://aur.archlinux.org/yay-bin.git /tmp/yay-bin && cd /tmp/yay-bin && makepkg -si --noconfirm && rm -rf /tmp/yay-bin)'

# ── 2c. Omarchy itself ──────────────────────────────────────────────────────
# At /usr/share/omarchy, the path its scripts and Lua configs resolve
# ($OMARCHY_PATH), so the desktop is the real Omarchy desktop with its themes,
# keybinds and omarchy-* tools — not a bare compositor.
arch_root_run "test -d /usr/share/omarchy || git clone --filter=blob:none '$OMARCHY_REPO' /usr/share/omarchy"
arch_root_run "git -C /usr/share/omarchy fetch --filter=blob:none origin '$OMARCHY_REF' && git -C /usr/share/omarchy checkout --force '$OMARCHY_REF'"
arch_root_run 'ln -sf /usr/share/omarchy/bin/omarchy* /usr/local/bin/'
arch_root_run "printf 'OMARCHY_PATH=/usr/share/omarchy\nLANG=en_US.UTF-8\n' > /etc/environment"

# The user's Hyprland config is Omarchy's own (Lua modules that pull its
# defaults from $OMARCHY_PATH); monitors.lua is ours, because this desktop has
# no monitor (see monitors-headless.lua).
mkdir -p "$HOME_DIR/.config" "$HOME_DIR/.local/state/omarchy/toggles/hypr"
[ -d "$HOME_DIR/.config/hypr" ] || sudo cp -r "$ARCH_ROOT/usr/share/omarchy/config/hypr" "$HOME_DIR/.config/hypr"
sudo cp "$ARCH_ROOT/usr/share/omarchy/default/hypr/toggles/flags.lua" \
  "$HOME_DIR/.local/state/omarchy/toggles/hypr/flags.lua"
sudo cp "$TEMPLATE_DIR/monitors-headless.lua" "$HOME_DIR/.config/hypr/monitors.lua"
sudo chown -R "$(id -u):$(id -g)" "$HOME_DIR/.config/hypr" "$HOME_DIR/.local/state/omarchy"

# ── 3. The desktop as a service ─────────────────────────────────────────────
sudo cp "$TEMPLATE_DIR/arch-root.service" /etc/systemd/system/arch-root.service
sudo cp "$TEMPLATE_DIR/omarchy-desktop.service" /etc/systemd/system/omarchy-desktop.service
sudo systemctl daemon-reload
sudo systemctl enable arch-root.service omarchy-desktop.service
sudo systemctl restart arch-root.service omarchy-desktop.service

# ── 4. Point the agent's browser at the Omarchy desktop ─────────────────────
# The one line of the baseline this environment changes: the browser (and every
# other X client Hermes starts) lands on Hyprland's Xwayland, i.e. inside the
# Omarchy desktop, instead of the box's bare X display.
sudo sed -i "s/^DISPLAY=.*/DISPLAY=$OMARCHY_DISPLAY/" "$ENV_FILE"
grep -q "^DISPLAY=$OMARCHY_DISPLAY$" "$ENV_FILE" || \
  echo "DISPLAY=$OMARCHY_DISPLAY" | sudo tee -a "$ENV_FILE" >/dev/null

# Tell the agent it is on Omarchy, and that pacman/AUR/omarchy-* exist. The
# baseline's "## Your own computer" block stays; this appends the delta.
if ! grep -q '## Your Omarchy desktop' "$HOME_DIR/.hermes/SOUL.md" 2>/dev/null; then
  cat >> "$HOME_DIR/.hermes/SOUL.md" <<'EOF'

## Your Omarchy desktop
Your computer runs Omarchy — the Hyprland tiling desktop on Arch Linux — and
that is the desktop your browser and every window you open appear on, and what
your human sees when they watch or take over your screen. Arch tooling lives
one command away: `arch-run '<command>'` runs anything in the Arch userland,
including `pacman`/`yay` when you genuinely need software that is not installed
yet, and Omarchy's own `omarchy-*` helpers (themes, window and layout control).
Install deliberately and tell your human what you installed and why.
EOF
fi

# ── 5. Re-run the C24 gate on the final config ──────────────────────────────
# Nothing above touches config.yaml, but the environment must not be the reason
# a second messaging platform ever ships enabled.
"$HOME_DIR/.hermes-venv/bin/python" "$BASE_TEMPLATE_DIR/generate_platforms.py" \
  --hermes-repo "$HOME_DIR/hermes-agent" \
  --config "$HOME_DIR/.hermes/config.yaml" \
  --verify

sudo systemctl restart hermes-gateway hermes-dashboard

echo "Omarchy template overlay complete (arch root $ARCH_ROOT, display $OMARCHY_DISPLAY)."
