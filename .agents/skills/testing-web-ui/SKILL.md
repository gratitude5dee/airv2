---
name: testing-web-ui
description: How to run and test the airv2 Next.js web app (apps/web) locally, including auth/env limitations.
---

# Testing the airv2 web app locally

- App lives in `apps/web` (npm workspace). Build: `(cd apps/web && npm run build)`; serve prod build: `(cd apps/web && npx next start -p 3999)`. A `next start` on port 3999 may already be running — check `curl -s -o /dev/null -w "%{http_code}" http://localhost:3999/` and compare `.next/BUILD_ID` mtime with `git log -1 --format=%ci` to confirm the build matches HEAD.
- To test API route auth contracts (401/400 vs 500) without real credentials, start the server with dummy env vars: `SUPABASE_URL=https://fake-project.supabase.co SUPABASE_SERVICE_ROLE_KEY=dummy SESSION_SECRET=<random> ... npx next start -p 3999`. `serviceClient()` constructs without network I/O, so routes exercise their full auth logic and only fail when they actually query Supabase (which typically resolves to 401, not 500). Set every `required()` var from `lib/env.ts` to a dummy value. With a known `SESSION_SECRET` you can also mint valid/expired/typ-confused HMAC tokens in a `/tmp` script (mirror the `payload.b64url + "." + HMAC-SHA256` scheme in `lib/auth/desktop.ts`) to probe bearer-token routes. `npx tsx` can import `lib/auth/*.ts` directly for library-level token lifecycle tests.
- No `.env` files exist locally, so backend-dependent paths fail: `/api/auth/login` returns 500 (login UI shows inline "could not send code"), `/api/me` returns 401, and any Supabase-backed server page (e.g. `/@handle` contact card) throws a 500 "Application error". Authenticated `/home` dashboard, PromptInput composer, and mini-app webviews are unreachable without Supabase env + a real account.
- `/home` is a client component that fetches `/api/me` and does `router.push("/login")` on 401 — test the redirect through the browser URL bar, not curl (curl on `/home` returns 200 shell HTML).
- Secret-leak scans: grep rendered HTML (`curl /` and `/login`) and `.next/static` chunks for model names / `sk-` keys. Note: dither-kit uses CSS variables named `sk-image-*` — these are NOT secrets.
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

## Devin Secrets Needed
- Supabase URL/service key env vars (not currently stored) to test authenticated views and `/@handle` cards.
- `OPENAI_API_KEY` (available in shell env) for real `/audio/transcriptions` round trips.
