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
