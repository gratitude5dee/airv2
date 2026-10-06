# Miniapp Studio & owner-gated app testing

Verified recipes for exercising CreateStudio, the `?version=` pin lane, and
owner-gated serving locally. All confirmed on the mini host against real
Supabase + an R2 stub.

## Prod `next start` boot env

`validateEnv` throws at boot unless ALL REQUIRED_ENV are set (~26 vars:
ADMIN_API_KEY, AGENTMAIL_API_KEY, AGENTMAIL_WEBHOOK_SECRET, BOX_API_KEY,
BOX_TEMPLATE_ID, COMPOSIO_API_KEY, COMMAND_LANE_KEY, MASTERKEY_PARTNER_SECRET,
MINIAPP_SIGNING_KEY, SESSION_SECRET, SPECTRUM_PROJECT_ID/SECRET/WEBHOOK_SECRET,
STRIPE_SECRET_KEY/WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL,
TENKI_API_KEY, THIRDWEB_SECRET_KEY, WZRDMAIL_API_KEY/WEBHOOK_SECRET,
MODEL_PROVIDER_API_KEY, MODEL_PROVIDER_BASE_URL, STT_API_KEY, STT_BASE_URL).
Loop-export `dummy-<NAME>` for everything except the reals you need
(SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SESSION_SECRET +
MINIAPP_SIGNING_KEY + MINIAPP_ORIGIN + R2_*). To make `dev_available` true in
`/api/create/status` also set APP_ORIGIN_SIGNING_KEY + CLOUDFLARE_ACCOUNT_ID +
CLOUDFLARE_API_TOKEN + CF_MANIFEST_KV_ID — dummy values are fine, the flag is
env-presence only.

## mini_store cookie without OTP

Mint the store session yourself — no login flow needed:

```js
// claims: {userId, app:"__store", resourceId:"store", jti:<rand>, exp:<ms>}
const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
const sig = createHmac("sha256", MINIAPP_SIGNING_KEY).update(payload).digest("base64url");
const token = `${payload}.${sig}`;
// then browse: http://localhost:3999/api/mini/session?t=<token>&next=/create?app=<slug>
// -> 303 + Set-Cookie: mini_store (HttpOnly, SameSite=lax, Path=/)
```

With `MINIAPP_ORIGIN=http://localhost:3999`, localhost:3999 IS the mini host:
`/create` → `/mini/create`, `/<u>/<a>` → `/mini/<u>-<a>`, `/api/create/*` passes
through. The cookie survives server restarts if SESSION_SECRET /
MINIAPP_SIGNING_KEY are persisted to files and re-exported. A `mini_store`
session whose userId equals `mini_apps.owner_user_id` is an owner session:
draft-status apps and the session gate pass without a card cookie.

## R2 stub so version-pinned iframes actually render

The VM can't reach Cloudflare R2. Stub it:

1. `openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -subj "/CN=<R2_ACCOUNT_ID>.r2.cloudflarestorage.com" -days 1`
2. `/etc/hosts`: `127.0.0.1 <R2_ACCOUNT_ID>.r2.cloudflarestorage.com`
3. HTTPS :443 node server keyed on `apps/<slug>/<version>/index.html`, each
   bundle a visibly distinct HTML ("DRAFT-BUNDLE v…" etc.) — the iframe then
   literally shows which version rendered.
4. Launch next with `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Run as root (port 443): `setsid sudo -n node stub.mjs`. `fuser -k 443/tcp` may
not kill a root-owned listener — find the pid via `sudo ss -ltnp | grep :443`
and `sudo kill`.

## miniapp_versions / draft seeding constraints

- `bundle_sha256` must be 64 lowercase-hex chars; `version` must match
  `v<digits>` (e.g. v1999000000001).
- Draft|Live preview toggle needs a published app whose `mini_apps.draft_version`
  ≠ `bundle_version`. Repoint draft_version to an older real version row for
  the app (restore afterwards).
- A draft-status app renders for the owner via mini_store — no special setup
  beyond the cookie + a bundle at `bundle_version` in the stub.
- `?version=<v>` pin lane: no cookie → 403; owner cookie → 200 + sets
  `mini_ver_<slug>`; bogus version → 404.

## Reaching main-host routes (e.g. /api/admin/*) on the same server

localhost:3999 routes as the MINI host — `/api/admin/*` 404s there. Add a
throwaway hosts alias (`127.0.0.1 cp.local`) and curl
`http://cp.local:3999/api/admin/...` — Host ≠ MINIAPP_ORIGIN → main-host
routing → route works. Admin routes need `Authorization: Bearer $ADMIN_API_KEY`
plus `X-Admin-Operator: <id>` matching `/^[A-Za-z0-9._@-]{1,64}$/`.

## Chrome-for-Testing on this box

- Binary: `/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome`;
  profile `~/.config/google-chrome-for-testing`; CDP :29229.
  `google-chrome "<URL>"` PUTs the exact URL via /json/new — use it for long
  signed URLs (the omnibox mangles ~250-char URLs and lands you on /login).
- Never Ctrl+W the last tab — it kills ALL of Chrome and breaks
  browser_console/read_dom permanently (they attach through devin-remote
  state). Relaunch manually with the same profile +
  `--remote-debugging-port=29229`; screenshots/clicks keep working.
- When browser_console/read_dom are dead, drive the relaunched Chrome over raw
  CDP (Node ≥22 built-in WebSocket): GET `localhost:29229/json` → find target
  by url substring → `Runtime.evaluate` on its webSocketDebuggerUrl. Reads
  iframe src, anchor hrefs/getBoundingClientRect for precise clicks.
- `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz` works; display is
  3200x2400 real / 1024x768 tool coords (factor 3.125) — DOM rects ÷ 3.125 =
  click coords.
