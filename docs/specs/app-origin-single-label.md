# App-Origin Single-Label Hostnames

Flattens the V11/V13 app-origin hostnames from second-level subdomains
(`<slug>.apps.wzrd.tech`, `<slug>.dev.wzrd.tech`) to single-label hosts
(`<slug>-apps.wzrd.tech`, `<slug>-dev.wzrd.tech`) so the lanes serve on the
zone's free Universal SSL cert and the existing `*.wzrd.tech` wildcard DNS.

## Why

`*.wzrd.tech` Universal SSL covers exactly one label: `anything.wzrd.tech`
gets TLS for free, `anything.apps.wzrd.tech` does not. Serving the V11 scheme
as spec'd requires Advanced Certificate Manager (paid) or Workers for
Platforms custom hostnames. The redesign keeps the security model — each app
is still its own origin — while removing the cert dependency.

Verified on the zone (2026-10-06): `POST /workers/routes` accepts
`*-apps.wzrd.tech/*` (wildcard at the start of the hostname only; prefix
wildcards like `a-*.wzrd.tech` are rejected with code 10022). DNS
`*.wzrd.tech` A records are already proxied, so every single-label host
resolves today with no DNS work.

## Scheme

| Purpose | Old (V11/V13) | New |
|---|---|---|
| Live app origin | `<slug>.apps.wzrd.tech` | `<slug>-apps.wzrd.tech` |
| Dev app origin | `<slug>.dev.wzrd.tech` | `<slug>-dev.wzrd.tech` |
| Dispatcher health | `dispatch.apps.wzrd.tech` | `apps.wzrd.tech` |

Parse rule (both workers): host must end with `-<suffix-domain>`; strip
exactly one trailing suffix; the remainder must match `SLUG_RE`
(`<u>-<a>`). Deterministic and collision-free:

- slug `gratitude-player` → live `gratitude-player-apps.wzrd.tech`
- app literally named `apps` (slug `gratitude-apps`) → `gratitude-apps-apps.wzrd.tech`
- `gratitude-apps.wzrd.tech` strips to `gratitude` → fails SLUG_RE → 404
  (the slug namespace and the suffix namespace cannot collide because a
  bare `<u>` never parses)
- dev and live suffixes are disjoint (`-dev` vs `-apps`), so the dev lane
  cannot shadow a live app and vice versa
- `apps.wzrd.tech` itself does not match `*-apps.wzrd.tech` (no `-apps`
  suffix) — it serves `/__air/health` and `/__air/csp` via an exact route

Isolated-origin invariants are unchanged: `__Host-air_app` stays a
host-scoped cookie, and app code still cannot reach sibling-app origins.

## Deltas

- `lib/miniapps/nested.ts` — `appOriginHost`: `${slug}.${suffix}` → `${slug}-${suffix}`
- `infra/workers/index.mjs` — `slugFromHost` uses `-${APPS_ORIGIN_SUFFIX}`;
  `wrangler.toml` routes `*-apps.wzrd.tech/*` + `apps.wzrd.tech/*`
- `infra/workers/dev-router/index.mjs` — `slugFromHost` strips `-dev.wzrd.tech`;
  `wrangler.jsonc` route `*-dev.wzrd.tech/*`
- `lib/create/release.ts` — `devOriginUrl` → `https://<slug>-dev.wzrd.tech/`
- `lib/env.ts` — `cfDispatchHealthUrl` default → `https://apps.wzrd.tech/__air/health`
- Test fixtures asserting `<slug>.apps.wzrd.tech` / `.dev.wzrd.tech` hosts

## Still required (unchanged)

- **Workers for Platforms** purchase — the `air-apps` dispatch namespace,
  `air-dispatcher`/`air-dev` deploys, and per-app script uploads all need it.
- Env/secrets on both sides (`APP_ORIGIN_SIGNING_KEY`, `CANDIDATE_SECRET`,
  `CLOUDFLARE_*`, `CF_*`) before the lane reports `dev_available`.

Static-only apps are unaffected either way — they keep serving through the
R2 lane (`?version=`, owner preview) on the mini origin.
