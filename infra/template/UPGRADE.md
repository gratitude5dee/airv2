# V0 — Hermes upgrade runbook (pin, rebuild, migrate the fleet)

The template pins Hermes at `HERMES_REF` (see `setup.sh`; currently
`7339f5f160db5c96657a3bab60151227cc61f66c` = tag `v2026.8.16.2`, pyproject
`0.20.3`, release line v0.20.2 / 2026-08-16). Re-pin deliberately with a
delta review — never float back to `main`.

## 1. Rebuild the template

1. Resume the template box (`infra/template/boxctl.sh resume <id>`).
2. Run `setup.sh` (idempotent: re-fetches the pinned ref, regenerates the
   platform block only when absent, reinstalls deps). The build **fails** if
   the C24 platform generation fails or any platform except `api_server` is
   enabled.
3. Confirm `~/.hermes/.template-hermes-ref` holds the resolved SHA and
   `~/.hermes-venv/bin/hermes --version` reports the expected 0.20.x.
4. Verify the secret-source re-pull (#64177) — V1 depends on it:

   ```bash
   mkdir -p ~/.hermes/plugins/dummy-source
   cat > ~/.hermes/plugins/dummy-source/plugin.yaml <<'EOF'
   name: dummy_source
   version: "0.0.1"
   EOF
   cat > ~/.hermes/plugins/dummy-source/__init__.py <<'EOF'
   from agent.secret_sources.base import (
       SECRET_SOURCE_API_VERSION, FetchResult, SecretSource,
   )

   class DummySource(SecretSource):
       name = "dummy_source"
       label = "Dummy"
       shape = "mapped"
       scheme = None
       api_version = SECRET_SOURCE_API_VERSION

       def fetch(self, cfg, home_path):
           return FetchResult(secrets={"AIR_DUMMY_SECRET": "dummy-ok"})

   def register(ctx):
       ctx.register_secret_source(DummySource())
   EOF
   # enable: add dummy-source to plugins.enabled and secrets.dummy_source.enabled: true
   sudo systemctl restart hermes-gateway
   # assert present at first boot:
   sudo cat /proc/$(systemctl show -p MainPID --value hermes-gateway)/environ \
     | tr '\0' '\n' | grep AIR_DUMMY_SECRET
   # disable the plugin, restart, assert absent. Then rm -rf the plugin dir.
   ```

5. Verify per-profile api_server auth (V7 substrate):
   `hermes profile create testbot`; a run against `/p/default/v1/runs` with the
   main `API_SERVER_KEY` succeeds; the same key against `/p/testbot/v1/runs`
   returns 401. Delete the test profile afterwards.
6. Warm: stop → resume → wait for units → stop (never `force: true`).
7. Record the box id as `BOX_TEMPLATE_ID` in Vercel (Production + Preview).

## 2. Migrate existing user boxes — in place, never re-fork

Existing boxes carry `~/.hermes` state (memory, sessions, skills); a re-fork
destroys it. For each box (resume it first):

```bash
HERMES_REF=7339f5f160db5c96657a3bab60151227cc61f66c
cd ~/hermes-agent
git fetch --depth 1 origin "$HERMES_REF" && git checkout --force FETCH_HEAD
UV_PROJECT_ENVIRONMENT=~/.hermes-venv uv pip install -e ".[all]" \
  --python ~/.hermes-venv/bin/python
git rev-parse HEAD > ~/.hermes/.template-hermes-ref
# regenerate the platform block if the box config predates C24 generation:
# delete the old hand-written `platforms:` block from ~/.hermes/config.yaml,
# then run infra/template/generate_platforms.py --hermes-repo ~/hermes-agent \
#   --config ~/.hermes/config.yaml  (and re-run the setup.sh §3e gate).
sudo systemctl restart hermes-gateway hermes-dashboard hermes-host
```

Then update the row: `update boxes set template_version = '<sha>' where
provider_box_id = '<box id>'`. Verify memory/sessions/skills are intact
(`hermes session list`, `~/.hermes/skills/`), and run the v2 regression sweep
(M0 stop/resume + re-host, M1 gateway turn with zero provider keys, M2
debounced iMessage round trip, M6 web chat SSE, M7 skills/MCP proxy,
computer relay card).

Re-fork only boxes with no user state.

## 3. MA9.1 — persistent memory enabled in the template config

`setup.sh` §3 now seeds a `memory:` block (`memory_enabled: true`,
`user_profile_enabled: true`, `write_approval: false` — writes are local file
edits, so they ride the box's smart-approvals posture rather than gating).
Boxes forked from an older template lack the block: during the in-place
migration above, append it to `~/.hermes/config.yaml` and restart
`hermes-gateway`. Verify with `hermes config get memory.memory_enabled` and
confirm `~/.hermes/memories/MEMORY.md` / `USER.md` appear after a turn that
saves a memory. Memory files are content: they stay in the box filesystem and
are surfaced only through the owner-session Settings Memory section and the
admin export (C4 — never Postgres, never logs).

## 4. MA10 — the app-store-search skill

The template now ships `skills/app-store-search` (baked by `setup.sh` §3c's
local-skill loop). It teaches the agent to search the public wzrd.tech app
directory through `GET /api/store/search` on the gateway origin — the same
public listing data any web reader sees. For existing boxes, copy the skill
directory into `~/.hermes/skills/app-store-search` during the in-place
migration; no config or service change is needed.

## 5. Browser Use CLI 3.0 — the browser-use skill + `box-browser-use`

`setup.sh` §3b2b installs the Browser Use CLI (pinned `browser-use==0.13.8`,
the CLI 3.0 / Browser Harness line) via `uv tool install --python 3.12` into
`~/.local/bin`, and ships `/usr/local/bin/box-browser-use` — a wrapper that
discovers the daemon Chrome's CDP port from its `DevToolsActivePort` file
(same discovery as air-vault) and exports `BU_CDP_URL` so the CLI attaches to
the box's ONE headed browser instead of launching its own. The template also
bakes `skills/browser-use`, which teaches the agent to pipe Python into
`box-browser-use` for multi-step web work while keeping the hard rules: no
cloud browsers, no `browser-use auth`, vault-only card fills, and the human
always clicks the final Place order button (shopping-checkout §5). For
existing boxes, `sync-box.sh` §3b performs the same install + wrapper write.
Verify: `box-browser-use --doctor` connects to the daemon Chrome, and
`~/.hermes/skills/browser-use/SKILL.md` is present.

## 6. Baseline parity — `sync-box.sh`

`infra/template/sync-box.sh` reconciles an EXISTING box to the current air
baseline in place (idempotent; never re-forks). It refreshes only
template-owned assets — air identity/SOUL sections, template skills
(air-onboarding, open-miniapp, calendar-native, vault-use, shopping-checkout,
…), the creative + air-vault plugins, the `air-vault` and `open-miniapp-card`
CLIs, browser CDP args/profile, memory + browser config blocks, and the three
systemd units — and preserves all user state (memories, sessions, vault
store, per-box secrets, user-installed skills). To run against a box:

```bash
# from the control plane / operator machine, with the box resumed:
tar czf - -C infra template | base64 -w0   # upload via the box files API
# on the box:
base64 -d air-template.b64 > t.tgz && mkdir -p air-template \
  && tar xzf t.tgz -C air-template && bash air-template/template/sync-box.sh
```

Verify afterwards: SOUL.md leads with "## You are air", required skills and
plugins present, `AGENT_BROWSER_ARGS` comma-separated with the CDP profile,
`air-vault`/`open-miniapp-card`/`box-browser-use` on PATH, all three units active, gateway
`/health` 200. Run it on the template box itself after template changes so
new forks inherit the baseline (then delete `AIR_VAULT_KEY` from the
template's `~/.hermes/.env` — provisioning writes a per-user key on fork).

## 7. Release channels — dev/prod fleet sync

The manual §6 procedure is now automated behind release channels:

1. **Cut a release** from a clean commit: `ADMIN_API_KEY=... APP_ORIGIN=...
   infra/template/release.sh "notes"`. This packs `infra/template/` at HEAD,
   stores the tarball immutably in R2 with its sha256, and records the row in
   `template_releases` (with the pinned Hermes ref from `setup.sh`).
2. **Deploy to dev**: `POST /api/admin/fleet/channels`
   `{"channel":"dev","release_id":...}`, then start a job with
   `POST /api/admin/fleet/sync` `{"channel":"dev"}`. Dev-channel boxes
   (`boxes.channel = 'dev'`) converge on the next cron sweeps.
3. **Promote to prod**: point the `prod` channel at the *same* release id and
   start a prod job with `canary_box_ids` set. Canaries must pass the
   `verify-box.sh` health gate before waves roll; failures pause the job.
4. **Rollback** is the same pointer move to the previous release id.

Per box the job runs exactly §6's steps — download, sha256 check,
`sync-box.sh`, then `verify-box.sh` — and only records `baseline_version`
after the gate passes. Stopped boxes are resumed and re-stopped; boxes in an
active conversation window are deferred. Hermes re-pins (§2) ride the same
job when started with `include_hermes: true` and the release carries a
`hermes_ref`. New user forks come from the channel's `template_box_id` when
set (`BOX_TEMPLATE_ID` remains the fallback).
