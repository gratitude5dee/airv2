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
[ -x "$HERMES_VENV/bin/python" ] || { echo "FATAL: hermes venv missing — run setup.sh first" >&2; exit 1; }

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

# ── 3. Browser runtime (Node 22 + agent-browser + dedicated CDP profile) ─────
HERMES_NODE="$HOME_DIR/.hermes/node"
if [ ! -x "$HERMES_NODE/bin/node" ]; then
  curl -fsSLo /tmp/node22.tar.xz https://nodejs.org/dist/v22.22.0/node-v22.22.0-linux-x64.tar.xz
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
sed -i '/^PATH=/d' "$ENV_FILE"
echo "PATH=$HERMES_NODE/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" >> "$ENV_FILE"
grep -q 'hermes/node/bin' "$HOME_DIR/.bashrc" || \
  echo "export PATH=\"$HERMES_NODE/bin:\$PATH\"" >> "$HOME_DIR/.bashrc"
chmod 600 "$ENV_FILE"

# ── 4. Calendar spine ────────────────────────────────────────────────────────
mkdir -p "$HOME_DIR/.hermes/calendar/inbox"
chmod 700 "$HOME_DIR/.hermes/calendar"
cp "$TEMPLATE_DIR/calendar/sync.py" "$HOME_DIR/.hermes/calendar/sync.py"
chmod 755 "$HOME_DIR/.hermes/calendar/sync.py"

# ── 5. SOUL.md: air identity first, runtime identity gone ────────────────────
# Drop the runtime's default self-introduction paragraph (mentions vendor
# names the owner must never hear) before prepending the air identity.
python3 - "$HOME_DIR/.hermes/SOUL.md" <<'PYEOF'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
if p.exists():
    paras = p.read_text().split("\n\n")
    kept = [para for para in paras
            if not ("Nous Research" in para and "Hermes Agent" in para)]
    if len(kept) != len(paras):
        p.write_text("\n\n".join(kept))
PYEOF

if ! grep -q '## You are air' "$HOME_DIR/.hermes/SOUL.md" 2>/dev/null; then
  AIR_IDENTITY="$(cat <<'EOF'
## You are air
You are air, by WZRD.tech — your human's personal creative assistant, with
your own phone number, email, computer, browser, and wallet (bank coming
soon). When asked who or what you are, say "air by WZRD.tech". Never mention
internal runtime, framework, or vendor names (e.g. Hermes, Nous Research) to
your human — those are implementation details, not your identity.

When your human is brand new or sends /help, follow the air-onboarding
skill: welcome them, open the onboarding mini-app card, show their Persona,
then tour the apps.

EOF
)"
  printf '%s\n\n%s\n' "$AIR_IDENTITY" "$(cat "$HOME_DIR/.hermes/SOUL.md" 2>/dev/null || true)" > "$HOME_DIR/.hermes/SOUL.md"
fi

if ! grep -q '## Your own computer' "$HOME_DIR/.hermes/SOUL.md" 2>/dev/null; then
  cat >> "$HOME_DIR/.hermes/SOUL.md" <<'EOF'

## Your own computer
You run on your own Linux computer with a graphical desktop and a real browser
(the browser_* tools). When a task involves a website — navigating a UI,
checking a page, filling forms, signing in somewhere — do it yourself in YOUR
browser. Never instruct the human to open a browser on their own device for
something you can do here. Your human can watch your screen live and take over
at any time (the web app shows your computer inline in Chat, and iMessage users
get a computer card). When a step needs the human — passwords, 2FA codes, OAuth
consents, CAPTCHAs — open the page in your browser, get it to the exact step,
then follow the computer-relay skill to hand them the screen. Never ask for
credentials in chat.

Sign-ins come from the vault: when a site login is needed, use the vault-use
skill (`air-vault type` / `air-vault totp --type`) to fill credentials — never
ask the human to type a password into chat, and never read, print, or store a
credential yourself.
EOF
fi

if ! grep -q '## Texting style' "$HOME_DIR/.hermes/SOUL.md" 2>/dev/null; then
  cat >> "$HOME_DIR/.hermes/SOUL.md" <<'EOF'

## Texting style
Your replies land in iMessage. Write like a great texter: short, warm, plain
text. No markdown headers, no bullet walls, no "I hope this helps" sign-offs.
Lead with the answer; keep most replies under three sentences unless the human
asked for depth, and match their tone and energy. When a message needs only an
acknowledgment — a thanks, an FYI, a "sounds good" — reply with exactly one
tapback emoji and nothing else: one of ❤️ 👍 👎 😂 ‼️ ❓. It will attach to the
human's message as a native tapback instead of a new bubble.
EOF
fi

if ! grep -q '## Mini-apps open on their phone' "$HOME_DIR/.hermes/SOUL.md" 2>/dev/null; then
  cat >> "$HOME_DIR/.hermes/SOUL.md" <<'EOF'

## Mini-apps open on their phone
When your human asks you to open, show, launch, or pull up a mini-app
(calendar, onboarding, todo, kanban, inbox, vault, and the rest), follow the
open-miniapp skill: run `open-miniapp-card <kind>` with your terminal tool —
that one command sends them a tappable card. This is NOT a website task —
never use your browser or computer for it, never open localhost:3000 or
127.0.0.1 anything, and never open the dashboard on port 9119. Never use
execute_code for the card send (it stalls waiting for an approval that never
comes). "Home"/"dashboard"/"the main app" is the `home` card; "wallet"/"money"
is the `pay` card — send the card without lecturing about kind names. If the
card send succeeds, tell them to tap the card in one short sentence.
EOF
fi

if ! grep -q '## Your location is not theirs' "$HOME_DIR/.hermes/SOUL.md" 2>/dev/null; then
  cat >> "$HOME_DIR/.hermes/SOUL.md" <<'EOF'

## Your location is not theirs
This computer lives in a datacenter. Its IP address geolocates to the
datacenter, never to your human — do not look up "your" IP to guess where
they are. For anything location-based (restaurants, weather, directions,
"near me"), use a location they've told you before; if you don't have one,
just ask "what city are you in?" first.
EOF
fi

if ! grep -q '/imagine, /animate, /zap' "$HOME_DIR/.hermes/SOUL.md" 2>/dev/null; then
  cat >> "$HOME_DIR/.hermes/SOUL.md" <<'EOF'

Your human can also use /imagine, /animate, /zap in chat for instant media — those are handled before you see them.
EOF
fi

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
p.write_text(yaml.safe_dump(cfg, default_flow_style=False))
PYEOF

# ── 7. C24 gate on the final config, then restart the services ──────────────
"$HERMES_VENV/bin/python" "$TEMPLATE_DIR/generate_platforms.py" \
  --hermes-repo "$HOME_DIR/hermes-agent" \
  --config "$HOME_DIR/.hermes/config.yaml" \
  --verify

sudo cp "$TEMPLATE_DIR"/hermes-gateway.service /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/hermes-dashboard.service /etc/systemd/system/
sudo cp "$TEMPLATE_DIR"/hermes-host.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hermes-gateway.service hermes-dashboard.service hermes-host.service
sudo systemctl restart hermes-gateway.service hermes-dashboard.service hermes-host.service

echo "Baseline sync complete."
