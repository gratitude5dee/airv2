#!/usr/bin/env bash
# Turn a throwaway Linux host (Tenki Cloud / GitHub Actions runner, a fresh
# VM with systemd as PID 1) into an OpenViking box replica: the box user, the
# pinned server venv, ovctl and the real systemd units — the deep-memory
# slice of setup.sh §3c2, nothing else. Run as root. livecheck.py then
# drives it as the box user.
#
# The pinned install line is read from setup.sh so the replica can never
# drift from what the template box installs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BOX_USER=user
HOME_DIR="/home/$BOX_USER"

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[ "$(ps -o comm= -p 1)" = systemd ] || { echo "PID 1 is not systemd; the unit/timer checks need a real systemd host" >&2; exit 1; }

OV_PIN="$(grep -o "'openviking\[local-embed\]==[0-9.]*' 'openviking-sdk==[0-9.]*'" "$TEMPLATE_DIR/setup.sh")"
[ -n "$OV_PIN" ] || { echo "could not read the OpenViking pin from setup.sh" >&2; exit 1; }

id -u "$BOX_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$BOX_USER"
printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$BOX_USER" > /etc/sudoers.d/90-box-user
chmod 440 /etc/sudoers.d/90-box-user

apt-get update -qq
apt-get install -y -qq --no-install-recommends cmake build-essential curl ca-certificates python3

sudo -u "$BOX_USER" -H env OV_PIN="$OV_PIN" bash -s <<'SH'
set -euo pipefail
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
OV_VENV="$HOME/.openviking-venv"
uv venv "$OV_VENV" --python 3.12
eval "set -- $OV_PIN"
CMAKE_ARGS="-DGGML_NATIVE=OFF" uv pip install --python "$OV_VENV/bin/python" --no-binary llama-cpp-python "$@"
mkdir -p "$HOME/.hermes/context" "$HOME/.hermes/memories"
touch "$HOME/.hermes/.env"
mkdir -p "$HOME/.openviking" && chmod 700 "$HOME/.openviking"
SH

install -o "$BOX_USER" -g "$BOX_USER" -m 755 "$SCRIPT_DIR/ovctl.py" "$HOME_DIR/.openviking/ovctl.py"
install -o "$BOX_USER" -g "$BOX_USER" -m 755 "$SCRIPT_DIR/livecheck.py" "$HOME_DIR/.openviking/livecheck.py"

tee /usr/local/bin/ovctl >/dev/null <<SH
#!/usr/bin/env bash
set -euo pipefail
exec "$HOME_DIR/.openviking-venv/bin/python" "$HOME_DIR/.openviking/ovctl.py" "\$@"
SH
chmod +x /usr/local/bin/ovctl

cp "$TEMPLATE_DIR/openviking.service" "$TEMPLATE_DIR/openviking-index.service" "$TEMPLATE_DIR/openviking-index.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now openviking-index.timer
systemctl enable --now openviking.service

echo "replica provisioned: $OV_PIN"
systemctl --no-pager --no-legend list-units 'openviking*'
