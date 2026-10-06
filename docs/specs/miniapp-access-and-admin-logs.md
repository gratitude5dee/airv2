# Mini-app access paths + admin event logging (spec)

R-LOGS-01/02/03. Two asks, one root cause: "unable to access the created
miniapps" (live *and* in deployment), plus logging surfaced in the admin
panel and a pass on the `/create` studio UI.

## Verified root cause — every access path an owner clicks is dead

Two independent dead paths, verified against prod on 2026-10-06:

### D1 — Live apps 403 for the owner

`mini.wzrd.tech/<user>/<app>` is session-gated: the MA5 chain ends at
`sessionFromCookie`, which only accepts a signed card link (`?t=`) or a
live `mini_<slug>` cookie from a previous redemption. The studio's "Open"
and every other in-product link sends the owner to the **bare** URL →
`sessionExpired` 403 in any context that lacks the cookie (new device,
Safari outside the Messages webview, expired 15-min cookie). Prod check:
`curl https://mini.wzrd.tech/gratitude/player` → 403 "This link has
expired" while the app is `published`/healthy.

### D2 — Every deployment-side path depends on an origin that isn't live

Draft preview (`__air/enter`), dev links (`link.wzrd.tech/<u>/<a>`), and
the app-origin handoff all terminate on `*-apps.wzrd.tech` / the link
worker. Prod check: `curl https://gratitude-player-apps.wzrd.tech/` → TLS
handshake failure (no DNS/cert); `appOriginLaneReady()` is therefore the
honest signal — `draftPreviewUrl` is null and `promoteToDev` would 503.
Every prod `miniapp_versions` row has `worker_sha256 = null` → all serving
is the legacy R2 lane.

## Design

### Owner pass-through (fixes D1)

The owner's `mini_store` session cookie already proves their identity
host-wide. `ownerSessionFromStore(request, app)` maps a valid store
session whose `user_id === app.owner_user_id` onto a synthetic owner
`MiniSession` (`resourceId: "default"`, `role: "owner"`), appended at the
**session leg** of both gate chains (`runGateChain`,
`runPublicGateChain`) and the `[...path]` asset route — gate order is
untouched (visibility → password → x402 → session). Consequences:

- Owner opens their own live app anywhere they're logged into the store.
- Owner opens **draft-status** apps (previously 404 to everyone,
  including the owner — the visibility gate runs first, so the owner
  check must precede the visibility verdict for `status === "draft"`).
- No behavior change for guests: the fallback only fires when the store
  cookie verifies *and* matches the owner.

### Version-pinned serving lane (fixes D2 without new infra)

`GET /mini/<app>?version=vNNN` renders any non-retired, non-purged
`miniapp_versions` row through the published-module render path instead
of `bundle_version`. The response sets `mini_ver_<slug>` (15-min,
HttpOnly, path-scoped to the app) so relative assets under `[...path]`
resolve against the pinned version; an unpinned load clears it. Pins
skip the app-origin handoff (a pinned render is definitionally the R2
lane) and are ignored for first-party modules. Guests of public apps can
pin a non-retired older version of the same app — accepted: same app's
publish-grade content, no new authority.

This gives "access in deployment" today: `?version=` on the app's own
URL needs no apps.wzrd.tech, no dev release, no signed token.

### `dev_available` status flag

`GET /api/create/status` gains `dev_available: appOriginLaneReady()` —
the studio hides "Publish dev link" while the lane can't serve, and the
operator can see *why* dev links are dead instead of a silent 503.

### CreateStudio UI

- Picker gains an **Open live / Open owner preview** link on the app's
  own URL (works for drafts too via the pass-through).
- **Preview pane gets a Draft|Live toggle.** Draft = `?version=<draft>`
  on the app URL; Live = the plain URL; both render in the same iframe
  through the owner pass-through, so the frame works even with the app
  origin down. Reload bumps an epoch param (no token to re-mint); the
  `preview_url` app-origin URL is no longer used in-studio.
- **Every non-retired version row gets Preview** → `?version=<v>` in a
  new tab (previously only draft/live could be opened at all).
- **Release tab** shows *Publish dev link* when `dev_available` (hidden
  otherwise — promoting would 503 against the dead lane).
- Tab bar scrolls horizontally instead of wrapping to two rows.

### `GET /api/admin/logs` + admin `/logs` page

One merged, newest-first stream over `ops_events` +
`miniapp_gate_events`, cursor-paged (`before` = `created_at`), filtered
by `user_id`, `kind`, `source` (ops|gate|all) and `app` (gate rows join
`mini_apps` for the slug; ops rows carry it in `ref`). Rows are metadata
only — ts, source, kind, app_slug, user_id, ref, bytes (C4/L4: no
prompts, no content). The admin repo renders it under **Logs** with the
same filter row + pager pattern as Traces, `UserLink`-resolved owners.

## Alternatives considered

- **Provision apps.wzrd.tech now.** Infra-side fix, not code; the owner
  access bug (D1) would still exist. The lane-aware flag makes the code
  correct *whenever* the origin lands, and `?version=` works today.
- **Owner bypass via a second signed-link mint.** Adds a token path the
  pass-through gets for free from `mini_store`; a store session is
  strictly stronger than a card link (it's the login), so trusting it
  for the owner adds no new surface.

## Tests

- `lib/miniapps/gates.test.ts` — pass-through admits the owner, rejects
  other users / missing cookie / forged cookie / ownerless apps.
- `app/api/admin/logs/route.test.ts` — auth, filter validation, merge
  order, `mini_apps.slug` join narrowing, cursor paging.
- `app/api/create/status/route.test.ts` — `dev_available` present
  (false without CF config).
