# V0 — Hermes upgrade runbook (pin, rebuild, migrate the fleet)

The template pins Hermes at `HERMES_REF` (see `setup.sh`; currently
`29112bef099274229cadff79cdff7bf7b99c4b77` = tag `v2026.8.31`, pyproject
`0.21.0`, released 2026-08-31). Re-pin deliberately with a delta review —
never float back to `main`. `infra/template-macos/setup.sh` carries the same
pin; `infra/template-omarchy/setup.sh` overlays the Linux template and
inherits it.

## 0. Delta review for the v2026.8.19 → v2026.8.31 re-pin

- **C24 platform union** — `plugins/platforms/*/` (22 dirs) and the
  `register_platform(` call count (66) are identical across the two
  revisions, so no box can gain a second door from the upgrade. Re-run
  `generate_platforms.py --verify` on the box anyway.
- **Secret-source API (V1)** — `SECRET_SOURCE_API_VERSION` is still `1`;
  `agent/secret_sources/base.py` and `tests/secret_sources/conformance.py`
  are byte-identical, so the vendored air-vault conformance kit holds.
- **Session DB schema** — `hermes_state.py` grew but the schema-version
  bump path is unchanged; safe on boxes that already migrated.
- **`hermes mcp add/list/test`** — `hermes_cli/mcp_config.py` only changed
  in the `configure` tool picker (glob `tools.exclude` handling);
  `cmd_mcp_add` / `cmd_mcp_list` / `cmd_mcp_test` and the `mcp_servers`
  config shape the Composio and MasterKey proxies write are untouched.
- `web.cache_enabled` / `web.cache_ttl_minutes` still do not exist — keep
  not seeding them.

## 0a. Delta review for the v2026.8.16.2 → v2026.8.19 re-pin (963 commits)

The three things a re-pin can break in this repo, and what the delta says:

- **C24 platform union** — `generate_platforms.py`'s union (the `Platform`
  enum ∪ `plugins/platforms/*/` ∪ every `register_platform(name=…)`) is
  unchanged at 34 names across the two revisions, so no box can gain a second
  door from the upgrade. Re-run `generate_platforms.py --verify` on the box
  anyway; the gate is the contract, not this note.
- **Secret-source API (V1)** — `SECRET_SOURCE_API_VERSION` is still `1` and
  `tests/secret_sources/conformance.py` is byte-identical, so the vendored
  air-vault conformance kit and the secret-source re-pull both still hold.
- **Session DB schema** — still v25; the only change is that the v25 prompt
  dedupe now pauses instead of raising when SQLite is contended, which fixes a
  gateway watchdog crash loop. Safe on boxes that already migrated.

Upstream work that matters to us: keyless/free provider catalog fixes around
Ox Alpha (reasoning effort now reaches the wire clamped), cron agents run with
memory enabled, `hermes update --plan`, and desktop-only performance work we
do not ship.

## 1. Rebuild the template

1. Resume the template box (`infra/template/boxctl.sh resume <id>`).
2. Run `setup.sh` (idempotent: re-fetches the pinned ref, regenerates the
   platform block only when absent, reinstalls deps). The build **fails** if
   the C24 platform generation fails or any platform except `api_server` is
   enabled.
3. Confirm `~/.hermes/.template-hermes-ref` holds the resolved SHA and
   `~/.hermes-venv/bin/hermes --version` reports the expected 0.21.x.
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
HERMES_REF=29112bef099274229cadff79cdff7bf7b99c4b77
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

## 5b. 1Password CLI (`op`) — installed for everyone, active only on opt-in

`setup.sh` §3b2d (and `sync-box.sh` §3b++ for existing boxes) downloads the
pinned 1Password CLI `op_linux_amd64_v2.35.0.zip` from
`cache.agilebits.com`, verifies its sha256
(`4457ade59850b852c64c77164235b34dd0b984ef7826eb0ccd32f1fd78a2ceb7`),
installs it as `/usr/local/bin/op`, and confirms `op --version`.
`verify-box.sh` gates on the same command.

The binary carries NO credential and reads nothing on its own. It only
resolves anything after the owner explicitly connects a 1Password account
(onboarding's optional "Bring your own manager" form or the Vault tab →
`enable_manager`), which writes `OP_SERVICE_ACCOUNT_TOKEN` into
`~/.hermes/.env` via `lib/vault/managers.ts`. Boxes whose owner never
connects 1Password behave exactly as before: `air-vault op-fill` exits
non-zero with `op_not_connected` before it ever spawns `op`.

With the token present, `air-vault op-fill --ref "op://<vault-id>/<item-id>/<field>"`
resolves ONE field in-process (`op read`, token from env, never argv) and
delivers it into the frontmost browser page over the same CDP transport as
local vault items — refusing unless the page host is granted for the item's
stable grant key `op:<item-id>` in `~/.hermes/vault/site_grants.json`.
References and grant keys use the opaque 1Password ids from
`air-vault op-list` (vault/item titles are display labels only), so
duplicate titles stay distinct and renames don't orphan grants.
Only `typed <ref> into <host>` is ever printed. `skills/vault-use` teaches
the flow and marks it conditional on 1Password being connected.

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

## 6b. Web split + fast-tier delegation — `web:` and `delegation:` blocks

`setup.sh` §3 (and the macOS lane, and `sync-box.sh` for existing boxes) now
seeds two more config blocks:

```yaml
web:
  search_backend: ""
  extract_backend: ""
  extract_char_limit: 15000
  keyless_fallback: true
  keyless_rescue: true

delegation:
  model: "fast"
  max_concurrent_children: 4
  max_spawn_depth: 1
```

- **Three-job split.** `web_search` is discovery, `web_extract` is reading
  (deterministic head+tail budget, `extract_char_limit: 15000`), and the
  browser is reserved for interaction. The `browser-use` and
  `shopping-checkout` skills now say this explicitly. Extracted pages land in
  `~/.hermes/cache/web`, which is shared across subagent processes, so
  fan-out re-reads are near-free. The pinned Hermes has **no**
  `web.cache_enabled` / `web.cache_ttl_minutes` keys — the cache/web
  full-text store is unconditional — so we do not seed them; re-check on the
  next re-pin.
- **Independent backends.** `search_backend`/`extract_backend` stay `""`
  (keyless ring) until the vault provides a key: enabling a secrets manager
  (Bitwarden/1Password/command) now also runs a backend sync that inspects
  the mapped env-var names and picks a keyed provider per capability —
  search-only providers (brave-free, searxng, xai) are never chosen for
  extract. A backend the owner (or an operator) set by hand is never
  overwritten. With no matching key, the keyless ring plus
  `keyless_fallback`/`keyless_rescue` remain the safety net.
- **Vault-sourced web keys (C2).** `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`,
  `EXA_API_KEY`, `SEARXNG_URL`, etc. are NEVER written into the template
  `.env`. Users map them through their own secrets manager
  (`secrets.<manager>.mapped`) exactly like any other credential; air-vault
  resolves them into the box's `.hermes/.env` at gateway start.
- **Fast-tier children.** `delegation.model: "fast"` pins delegated
  research/search/browse children to the box-visible `fast` tier while the
  parent stays on the default (`balanced`). `delegation.provider` stays
  unset so children inherit the box's custom gateway credentials. The
  gateway honors a request-body `model: "fast"` as a downgrade-only
  override, and `MODEL_REASONING_FAST` defaults to `"low"` — there is no
  faster model slug; low reasoning effort IS the fast-mode lever. Keep
  `max_spawn_depth: 1`; if you raise it to 2, also set a non-zero
  `delegation.child_timeout_seconds` because nesting multiplies per-leaf
  runtime.
- **Bot profiles** get the same two blocks from
  `apps/web/lib/bots/provision.ts`.

## 6c. Eval test skills

`setup.sh` §3c's hub-install loop (and `BASE_SKILLS` in
`apps/web/lib/skills/hub.ts`) now includes the eval-test skill set —
agent-reach, defuddle, browser-harness, browser-testing-with-devtools,
hyperframes, composio, youtube-full, humanizer, and friends. Every
identifier was confirmed with `hermes skills search` against the pinned CLI;
never pin a guessed identifier. `resemble-detect` is vendored under
`infra/template/skills/resemble-detect/` (external repo, not in the hub).
The eval suite gained token/latency capture and a `research` category
(I101–I104: shopping, flight, reservation, multi-source fan-out) — see
`evals/agent-suite/`.

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

## 8. Action triggers — calendar writes and AgentMail drafts

`calendar-native`, `open-miniapp`, and `email-draft-review` were rewritten so
an *action* request is executed in the turn it arrives instead of described or
handed back as a mini-app card:

- `calendar-native` now advertises write intents in its frontmatter and runs
  `python3 ~/.hermes/calendar/sync.py upsert <base64-json>` on "schedule /
  add / move / cancel", with a worked example.
- `open-miniapp` cards are narrowed to OPEN / VIEW / SHOW requests; action
  requests explicitly belong to `calendar-native` / `email-draft-review`.
- `email-draft-review` recognises "send this", composes the body from the
  thread, calls the AgentMail MCP `create_draft`, then files `draft_id` at
  `/api/email/drafts/review`. Send stays in the control plane behind owner
  approval — the box's key drafts only.

All three are template-owned, so rollout needs **no code path change**:
`setup.sh` §3c copies them into `~/.hermes/skills` on fork and `sync-box.sh`
§1 replaces the template-owned skill directories on an existing box. Existing
boxes therefore pick the new triggers up on their next sync (§6, or the next
channel sweep in §7) — nothing to migrate by hand.

**Check the email flow can actually draft.** The skill is inert without both
halves of the AgentMail wiring, and a box missing them fails silently: the
agent has no `create_draft` to call and falls back to describing the email.
Both are provisioned automatically (`BASE_SKILLS` in
`apps/web/lib/skills/hub.ts`; `installAgentmailMcp` in
`apps/web/lib/provisioning/email.ts`), so this is a verification step for
older boxes forked before either landed:

```bash
# on the box:
test -f ~/.hermes/skills/email/agentmail/SKILL.md \
  || hermes skills install official/email/agentmail --yes
grep -A3 '^  agentmail:' ~/.hermes/config.yaml   # url + x-api-key, enabled: true
hermes mcp test agentmail                        # must list create_draft
```

If the `agentmail` MCP block is absent, re-run provisioning's
`installAgentmailMcp` for that box rather than hand-writing the key — the
value is the per-user `${AGENTMAIL_API_KEY}` from the box env.

## 9. Create Kit Design doc — `skills/create-miniapp/DESIGN.md`

The Box copy of the Air Create Design doc (goal-create-v11 §12.3) is a
**generated** file: `packages/create-kit/scripts/harvest.ts` writes
`packages/create-kit/DESIGN.md` and mirrors it byte-for-byte to
`infra/template/skills/create-miniapp/DESIGN.md`. Never edit either copy by
hand — `npx tsx packages/create-kit/scripts/verify.ts` (CI) fails when the
two differ or when either drifts from `kit/**/meta.json` + `prompts/src/`.
MC2 owns `skills/create-miniapp/SKILL.md`; until it lands the directory
carries only `DESIGN.md`, and `sync-box.sh` §1 already copies every
`skills/*/` directory, so no sync-box change is needed for the doc to reach
`~/.hermes/skills/create-miniapp/DESIGN.md`.

Rollout is the ordinary §7 flow — regenerate, commit, then
`ADMIN_API_KEY=... APP_ORIGIN=... infra/template/release.sh "create-kit
<version>"` and point `dev` at the new release. Verify on a box:

```bash
head -3 ~/.hermes/skills/create-miniapp/DESIGN.md   # GENERATED banner + Kit version
```

The Kit itself (`kit/`, `vendor/`) is **not** in the template: Boxes get the
Design doc and reference pages; component source reaches an app through the
Build Service (MC4), which reads `packages/create-kit` offline.
