# Creative plugin (CM1)

The creative backend plugin is a Hermes dashboard plugin baked into the box
template (CC9). It exposes a typed HTTP surface at
`/api/plugins/creative/*` on the dashboard port (9119): job submission and
lifecycle, asset listing/variants, packages, and the compiled brand the box
holds. Source of truth: `infra/template/plugins/creative/`.

## How the control plane reaches it

`/api/box/api/plugins/creative/...` → the allowlisted proxy
(`apps/web/app/api/box/[...path]/route.ts`) routes creative paths to the
box's dashboard hosted route. Dashboard auth is a login flow, not a header:
the proxy POSTs the sealed `boxes.dashboard_auth` credential (see
`SECURITY-DECISIONS.md`) to `/auth/password-login` and forwards the minted
`hermes_session_*` cookies on the proxied request; cookies never reach the
client. Asset
bytes (`/assets/{id}/bytes`) are deliberately not proxied to browsers —
CM2's `lib/assets/` pulls them server-to-server.

## Durability

Jobs live in SQLite at `~/.hermes/creative/creative.db`, never in memory.
On dashboard startup the plugin reconciles: any `running` job whose process
died (e.g. the box stopped mid-render) is failed with a retriable reason.

## Version bump procedure (CM1 task 7)

Plugin API routes mount once at dashboard startup — a rescan will NOT pick
up a new `plugin_api.py`. To ship a new plugin version:

1. Edit `infra/template/plugins/creative/` and bump `version` in
   `dashboard/manifest.json`.
2. Rebuild the template box: run `infra/template/setup.sh` in the template
   (it re-copies the plugin into `~/.hermes/plugins/creative`, records
   `CREATIVE_PLUGIN_VERSION` in `~/.hermes/.env`, and adds `creative` to
   the `plugins.enabled` allow-list in `~/.hermes/config.yaml` — user
   plugins are opt-in and their backend is not imported otherwise), then
   warm and stop it,
   and update `BOX_TEMPLATE_ID` if a new template box was created.
3. Existing user boxes keep the old plugin until either:
   - a **restart window**: for each box, copy the new plugin directory into
     `~/.hermes/plugins/creative` and `sudo systemctl restart
     hermes-dashboard` (fast, preserves the filesystem); or
   - a **re-fork** (destructive to box state — only for boxes that can be
     rebuilt from the control plane).
4. Never hot-install into a running box outside a documented window — a
   plugin version mismatch against `CREATIVE_PLUGIN_VERSION` is a startup
   warning, not a silent upgrade.
