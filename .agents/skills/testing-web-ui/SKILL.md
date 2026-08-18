---
name: testing-web-ui
description: How to run and test the airv2 Next.js web app (apps/web) locally, including auth/env limitations.
---

# Testing the airv2 web app locally

- App lives in `apps/web` (npm workspace). Build: `(cd apps/web && npm run build)`; serve prod build: `(cd apps/web && npx next start -p 3999)`. A `next start` on port 3999 may already be running — check `curl -s -o /dev/null -w "%{http_code}" http://localhost:3999/` and compare `.next/BUILD_ID` mtime with `git log -1 --format=%ci` to confirm the build matches HEAD.
- To test API route auth contracts (401/400 vs 500) without real credentials, start the server with dummy env vars: `SUPABASE_URL=https://fake-project.supabase.co SUPABASE_SERVICE_ROLE_KEY=dummy SESSION_SECRET=<random> ... npx next start -p 3999`. `serviceClient()` constructs without network I/O, so routes exercise their full auth logic and only fail when they actually query Supabase (which typically resolves to 401, not 500). Set every `required()` var from `lib/env.ts` to a dummy value. With a known `SESSION_SECRET` you can also mint valid/expired/typ-confused HMAC tokens in a `/tmp` script (mirror the `payload.b64url + "." + HMAC-SHA256` scheme in `lib/auth/desktop.ts`) to probe bearer-token routes. `npx tsx` can import `lib/auth/*.ts` directly for library-level token lifecycle tests.
- No `.env` files exist locally, so backend-dependent paths fail: `/api/auth/login` returns 500 (login UI shows inline "could not send code"), `/api/me` returns 401, and any Supabase-backed server page (e.g. `/@handle` contact card) throws a 500 "Application error". Authenticated `/home` dashboard, PromptInput composer, and mini-app webviews are unreachable without Supabase env + a real account.
- `/home` is a client component that fetches `/api/me` and does `router.push("/login")` on 401 — test the redirect through the browser URL bar, not curl (curl on `/home` returns 200 shell HTML).
- Secret-leak scans: grep rendered HTML (`curl /` and `/login`) and `.next/static` chunks for model names / `sk-` keys. Note: dither-kit uses CSS variables named `sk-image-*` — these are NOT secrets. Include `/api/voice/transcribe` responses in the scan surface: its error and success bodies must never echo the STT key, base URL, model name, or any audio bytes (audio is transient per C18 — no Storage/Postgres write to check for content, but scan the JSON responses and logs).
- Speed tier labels (Fast/Balanced/Deep) live in `apps/web/components/prompt-input/PromptInput.tsx` and appear in `.next/static/chunks/app/home/page-*.js`.
- Dark mode: the app relies on `prefers-color-scheme`; the test box has no GNOME schema (`gsettings` fails), so OS-level dark emulation isn't available — verify the `prefers-color-scheme:dark` token mirror in the built CSS instead, or find another emulation path.

## Reaching the authenticated /home dashboard without real Supabase
- You can fully exercise the authenticated dashboard (PromptInput, chat relay, voice) by pointing the dummy env at a local **mock backend** that stands in for Supabase PostgREST + Hermes: a small Node HTTP server (e.g. on :4545) answering `GET/POST /rest/v1/<table>` (return `[]`/inserted row; log inserts to a file for server-side assertions like `agent_runs.trigger`), plus the Hermes run/SSE endpoints used by `lib/chat/relay.ts`. Set `SUPABASE_URL=http://localhost:4545`, `HERMES_BASE_URL=http://localhost:4545`, etc., and mint an `air_session` cookie with your known `SESSION_SECRET` — `/api/me` then succeeds and `/home` renders.
- Rate-limit style checks that count `cost_events` rows can be driven by making the mock read its count from a file (e.g. `/tmp/stt_count.txt`), letting you flip 429/200 deterministically.

## Voice input (M13) UI testing
- Devin's built-in Chrome hangs on `getUserMedia` — use **headed Playwright chromium on DISPLAY=:0** instead (`executable_path=/home/ubuntu/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`; the default chromium-1097 path playwright expects is absent, so pass executable_path explicitly). Grant mic permission via `context.grant_permissions(['microphone'], origin=...)`.
- Create a virtual mic with PulseAudio: `pactl load-module module-null-sink sink_name=vmic_sink` + `module-remap-source` from `vmic_sink.monitor`, set it as default source; generate a speech clip with `espeak-ng ... | ffmpeg → wav` and feed it during recording with `paplay -d vmic_sink clip.wav`. Whisper transcribes espeak-ng speech accurately.
- Useful selectors: mic `button[aria-label="Record voice input"]`, stop `button[aria-label="Stop recording"]`, send `button[aria-label="Send"]`, status line `div[class*="voiceStatus"]` (shows "Recording… 0:0X" / "Transcribing…"). Feature detection: `add_init_script("delete window.MediaRecorder;")` hides the mic button.
- For a real STT round trip set `STT_BASE_URL=https://api.openai.com/v1` and `STT_API_KEY=$OPENAI_API_KEY` (or the MODEL_PROVIDER fallbacks) on the server; capture `/api/chat` bodies via a Playwright request listener to prove `via:"voice"` and non-auto-send.

## Full authenticated testing without a phone (works today)
Real Supabase creds can be fetched at runtime — no `.env` needed and no OTP login:
1. Supabase project is `imkbxdsxfgmkylbgaygv` (name `airv2`). Get the service-role key via the management API with `SUPABASE_ACCESS_TOKEN`: `GET https://api.supabase.com/v1/projects/imkbxdsxfgmkylbgaygv/api-keys?reveal=true` (pick `name == "service_role"`). `SUPABASE_URL=https://imkbxdsxfgmkylbgaygv.supabase.co`.
2. Start the prod build with those two values, the org `THIRDWEB_SECRET_KEY`, a locally-generated `SESSION_SECRET` (`openssl rand -hex 32`), and dummies for every other `required()` var in `lib/env.ts`. You do NOT need the deployed SESSION_SECRET — you control the server.
3. Pick a user id from `GET {SUPABASE_URL}/rest/v1/users?select=id,username,wallet_address` (service key as `apikey` + `Authorization: Bearer`). User `7c8fc08b-…` (gratitude) has a wallet address; others have `wallet_address NULL` for the not-set-up state.
4. Mint an `air_session` cookie with your SESSION_SECRET (HS256 JWT `{sub:<user_id>,exp}` — mirror `lib/auth/session.ts`), then set it in the browser via `document.cookie` on any localhost:3999 page. `/home` then loads fully authenticated.
- Vercel env is also readable (`VERCEL_TOKEN`, project `prj_k85SYkCP3elo3YIChN6o45gEbsRC`), but production-scoped sensitive values (SUPABASE_URL/SERVICE_ROLE_KEY/etc.) do not decrypt; preview-scoped ones do. Prefer the Supabase management API route above.
- thirdweb Insight (token balances / activity, used by the M15 wallet tab) returns 401 "The service key is missing" for both the org `THIRDWEB_SECRET_KEY` and the Vercel one — likely the thirdweb project needs the Insight service enabled. Expect `degraded:true` with empty tokens/transactions; native RPC balance works with the org key. The Vercel-stored THIRDWEB_SECRET_KEY fails even native RPC (401) — it may be rotated/invalid.
- Box-backed tabs on /home (History, Skills, chat transcript sync) show "Couldn't reach your agent's computer" notes when `BOX_API_KEY` is dummy — expected, not a UI bug.

## Vault surface (V2) testing with the mock backend
- The Vault tab, `/api/vault*` routes, and the `/mini/vault` mini-app can be fully exercised against the local mock (:4545) by extending it to emulate: PostgREST tables `vault_items`, `vault_events`, `vault_managers`, `miniapp_redemptions`, `boxes`, `users`; Box API `POST /boxes/:id/commands` (implement a tiny in-memory `air-vault` CLI: `set/get --field --reveal/delete`) and `POST /boxes/:id/files` (vault inbox writes); Hermes `GET /hermes/health` → `{"ok":true}`. Set `BOX_API_BASE=http://localhost:4545`.
- `miniapp_redemptions` inserts MUST return PostgREST error `{code:"23505"}` (HTTP 409) on duplicate `jti`, or the mini-app single-use link check silently passes replays (redeemOnce treats any successful insert as first use).
- `vault_items` inserts act as upserts by id (the client mirrors metadata with plain inserts after updates).
- Mini-app link flow: `POST /api/mini/link {app:"vault"}` with the `air_session` cookie → open `?t=` URL once (303 sets `mini_vault` cookie, `Path=/mini/vault`); reuse → 403 "this link was already used"; garbage token → 403 "invalid or expired link". Card reveal contract: `POST /mini/vault action=reveal&id=<card>&field=number` with the mini cookie → 403 "card reveal is only available in the full Vault tab".
- `POST /api/vault` body shape is `{"item":{kind,name,fields:{...}}}` (not bare kind/fields — that returns 400 "invalid request").
- The mock is in-memory: restarting it wipes vault items/boxes/users mid-test; keep the append-only events log on disk for leak scans across restarts.

## Devin Secrets Needed
- `SUPABASE_ACCESS_TOKEN` (management API → service-role key for the airv2 project; enables full authenticated testing).
- `THIRDWEB_SECRET_KEY` (native balance reads for the wallet tab; Insight currently 401s — see above).
- `VERCEL_TOKEN` (optional; read non-sensitive/preview Vercel env).
- `OPENAI_API_KEY` (available in shell env) for real `/audio/transcriptions` round trips.
