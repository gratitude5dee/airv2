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

## Devin Secrets Needed
- Supabase URL/service key env vars (not currently stored) to test authenticated views and `/@handle` cards.
