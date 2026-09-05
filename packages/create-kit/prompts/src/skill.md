# Create a mini-app

## 1. When this skill owns the turn

The owner wants an app or page to exist at `mini.wzrd.tech/<username>/<app-name>`: **build / make / create / host this / put this up / make this live / share this as a page / turn this into an app / give me a link for this / publish**. Two lanes, one result — a DRAFT the owner previews on their phone and makes live themselves:

- **Vibe** — the owner describes what they want. You plan, write the source, build, run QA, iterate. Read §4 (commands) and §6 (the loop).
- **Drop** — the owner sends an `.html`, a `.zip`, or names a folder. Attachments sit at `~/.hermes/inbox/<ts>-<name>`. Read §5.

Not for **open my app** (`open-miniapp` shows the card). Not for images or video — decline and offer a public media link through `/api/media/publish` (the storefront-commerce skill shows the call). Import from a repo is a later version: say you can build from a description or host a file today.

Run every command with the `terminal` tool (never `execute_code`). `air-create` is on `PATH`; it also lives at `~/.hermes/skills/create-miniapp/scripts/air-create`.

## 2. The contract, once

A mini-app is one static bundle behind the Air CSP ceiling. The Build Service enforces this; you keep to it so builds pass the first time:

- `index.html` at the bundle root (the build writes it for you from `src/main.tsx`; a `src/index.html` replaces the shell). Everything it loads is in the bundle: no CDN script, no web font, no remote image, no `<iframe>`, no `<meta http-equiv>`, no analytics. A bundle that names a host is refused.
- No client storage — `localStorage`, `sessionStorage`, `indexedDB`, cookies, service workers. State lives behind `useAirState()` from `@kit/air`.
- No `eval(`, no `new Function(`, no inline event handlers (`onclick=`), no `javascript:` URLs.
- Caps: 400 files, 24 MiB workspace, 512 KiB per source file, 2 MiB per `public/` asset (png/jpg/webp/gif/woff2/mp3/mp4; no svg in v1).
- Messages viewport: `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`, one column ≤ 36rem, `min-height: 100svh`, `env(safe-area-inset-*)` padding, ≥ 2.75rem (44px) touch targets, 16px inputs, a complete still frame under `prefers-reduced-motion`.
- Lite (`surface.lite: true`, the default): no `backdrop-filter`, no fixed backgrounds, DPR 1, no WebGL, no component whose catalog line says `lite=false`. Compact card 390×360 first, expanded 390×760 second.

## 3. Where the truth is

Read `~/.hermes/skills/create-miniapp/DESIGN.md` before choosing anything — it is the Kit's design doc, synced from the repo: doctrine, eight recipes, the catalog with `weight`, `lite`, `motion` and `tier` per component. Import only what it lists:

```tsx
import { useAirState, useLite, useReducedMotion, cn } from "@kit/air";
import Typewriter from "@kit/fancy/typewriter";
```

`@kit/<source>/<name>` is a catalog component; `@kit/air` is the shell (tokens, hooks, `cn`). `react`, `react-dom` and the packages DESIGN.md names as vendored resolve; any other bare import is a hard finding, and so is a URL import. Nothing is installed in this Box and nothing may be: **never run `npm install`, `npx`, `pnpm`, `bun`** — the Build Service resolves the Kit offline.

Use tokens (`var(--canvas)`, `var(--ink)`, `var(--accent)` …) and the shell classes (`.frame`, `header.bar`, `main.app`, `.panel`, `.row`, `.chip` …) before reaching for a component. Tailwind utility classes you use in `className` are generated at build time; there is no Tailwind config to edit.

## 4. Commands

```bash
air-create new <appname> [--lane vibe|drop|import] [--title "<name>"]   # scaffold ~/.hermes/create/<appname>/
air-create build <appname>        # Build Service → draft version + preview; prints findings
air-create qa <appname>           # Preview QA in this Box's browser; posts qa_score
air-create status <appname|slug>  # draft/live versions, findings, build log, qa_score, budget
air-create drop <path> [--name <appname>] [--title "<name>"]
air-create publish <appname> [--title "<name>"]   # files the owner's decision; never flips live
air-create functions <appname> [--egress <host> …] [--cap <usd>] [--db] [--kv]   # stages the backend; the owner approves
```

Each is `curl` to `/api/create/*` on the control plane with this Box's gateway token; nothing here talks to storage, Cloudflare or npm.

`new` writes the workspace and records the project in `~/.hermes/create/.active`. The **active project** is what "make it bigger", "change the colour", "build it" refer to when the owner does not name one — read `.active` first, ask only if it is empty. Chat sessions named `air-create-<appname>` are already scoped to that app.

```text
~/.hermes/create/<appname>/
  air.json          manifest, schema air.app.v1 (below)
  create.plan.md    your plan; rewrite it when the plan changes; it never leaves the Box
  src/main.tsx      entry (air.json `entry`); Kit imports allowed
  src/*.css         optional; bundled into app.css
  public/           static assets
  .build/           last build reply (build.json) and QA output (qa/report.json, qa/*.png)
```

`air.json` (every field but `schema`, `appname`, `name` has a default):

```json
{ "schema": "air.app.v1", "appname": "countdown", "name": "Tour countdown",
  "description": "Days until the October 3 show.", "lane": "vibe",
  "entry": "src/main.tsx", "theme": "atmosphere",
  "surface": { "lite": true, "expanded": true },
  "kit": { "components": ["fancy/basic-number-ticker", "air"] },
  "actions": ["rsvp"], "guestActions": ["rsvp"], "functions": null,
  "visibility": "unlisted", "access": "single" }
```

`visibility`, `access`, `password` and `price` are proposals the owner sees on the publish decision; the build never applies them and neither do you.

`build` answers in ≤ 60 s or hands back a build id it then polls for you (up to five minutes). The reply is JSON:

```json
{ "ok": true, "slug": "alice-countdown", "appname": "countdown", "version": "v1788600000000",
  "preview_url": "https://alice-countdown.apps.wzrd.tech/enter?t=…",
  "findings": [ { "file": "src/main.tsx", "line": 12, "rule": "foreign-import",
                  "severity": "hard", "hint": "…" } ],
  "sizes": { "js": 48211, "css": 9020, "total": 61233, "js_gzip": 15800 }, "log": ["…"] }
```

`ok: false` (or a non-2xx exit) means **no version was produced**: read `findings` and fix the source. `severity: "hard"` findings block; soft ones ship but name something that will not work under the policy.

`qa` needs a build first. It drives this Box's browser at the preview link through 390×360 / 390×760 / 390×844 with reduced motion off and on, saves screenshots to `.build/qa/`, and posts a content-free report (LCP is measured unthrottled in this Box, so treat a `lcp` failure as serious). The reply is `{ "qa_score": 0–100, "failed": ["contrast", …] }`. Rule ids: `page-errors`, `console-errors`, `csp-violations`, `off-origin-requests` (floors the score at 0), `contrast` (< 4.5:1), `touch-targets` (< 44px), `horizontal-overflow`, `lcp` (> 2.5 s), `incomplete-matrix`.

`status` on a name returns `status` (`draft`|`published`), `draft`/`live`, `build` (state, log tail, findings), `qa_score`, `budget` (`budget_usd`, `spent_usd`, `remaining_usd`) and `preview_url`.

## 5. Drop

```bash
air-create drop ~/.hermes/inbox/1712345678-index.html --name promo --title "Tour promo"
```

- `--name` is the app name: 1–32 lowercase letters, digits, hyphens; use the owner's word ("host this as promo" → `promo`). Reserved words (`create`, `api`, `admin`, …) are rejected — pick another.
- A folder is zipped for you (`python3 -m zipfile`); `index.html` must be at its root. A `.zip` is sent as-is. One `.html` becomes `index.html`.
- The reply has the same shape as `build`; report it the same way — `[card: app alice-promo]` for the reply above. Do not edit the owner's file to silence a finding unless they ask.

## 6. The loop (Vibe)

1. **Plan** (first turn): `air-create new <appname> --title "…"`, then write `create.plan.md` — the recipe you start from, the components you picked (with their `weight`/`lite` from the catalog), the screens, what the owner can do vs. what a guest can do. Five lines is enough.
2. **Build**: edit `src/`, then `air-create build <appname>`. Read `findings` before anything else.
3. **Review**: `air-create qa <appname>`. Fix every failed rule you can from the source; rebuild.
4. **Report**: one sentence and the card on its own line. The card marker takes the `slug` from the reply, never the bare app name:

```text
Countdown is staged as a draft — tap the card to preview it, then say "publish" when it should go live.
[card: app alice-countdown]
```

If a card went out in the last two minutes it is edited in place; do not send a second one. When the owner asks for a change, edit → build → (qa) → one line; the preview on their surface reloads by itself.

## 7. Publish — the owner's decision

When the owner says "publish", "ship it", "make it live":

```bash
air-create publish countdown
```

That files a **Needs-you** decision on their phone. Reply:

```text
Publish request is ready for your approval — tap Needs-you to make it live at mini.wzrd.tech/alice/countdown.
```

## 7a. Functions — a backend the owner approves

An app needs a backend when it must remember something across visitors, call inference, or reach one outside API. Add `functions/index.ts` (one Worker; imports only `@air/functions`, `hono`, `zod`) and declare it in `air.json`:

```json
"functions": { "entry": "functions/index.ts", "db": true, "egress": ["api.example.com"], "ai": { "dailyCapUsd": 0.5 } }
```

```ts
import { air } from "@air/functions";
const app = air.router();
app.post("/api/rsvp", async (c) => {
  if (c.user.role === "anon") return c.json({ error: "sign in" }, 401); // role is set by the platform, never the client
  await c.db.prepare("insert into rsvps (who) values (?)").bind(c.user.principal).run();
  return c.json({ ok: true });
});
export default app;
```

The page calls `/api/rsvp` on its own origin. `air.ai.chat()`, `air.state`, `air.actions` and `air.media` are the only ways out besides the hosts in `egress`; every other `fetch` is refused with `egress_denied`. `build` compiles the Worker into the DRAFT and files (or refreshes) a **miniapp_backend** Needs-you decision listing exactly the hosts, database / kv, daily cap and secret *names*. `air-create functions <appname> --egress api.example.com --cap 0.50` stages the same declaration without a build; with no flags it prints the backend status. Reply:

```text
Backend changes are staged — they need your approval in Needs-you (or the Functions tab) before the app can reach api.example.com or spend on inference.
```

Until the owner approves, the live app has no backend and the draft runs against nothing the owner did not already approve. Secrets (`API_KEY`) are set by the owner in the Functions tab and arrive as `env.API_KEY` in the Worker — never write one into `functions/`.

## 8. Reporting rules — no exceptions

- MUST NOT say the app is live, up, public, or shipped until `air-create status` shows `"status": "published"`. You stage; the owner publishes.
- MUST quote `findings` and QA `failed` rules verbatim (rule id, file, line, hint). Do not paraphrase them away.
- MUST report the preview as `[card: app <slug>]`. `preview_url` is the owner's and only works from their phone: never paste it, never open it, never curl it. `air-create qa` is the only thing that visits it.
- MUST NOT put a secret — key, token, password, phone number, address — in `src/`, `public/`, `functions/` or `air.json`. If the owner pastes one, say secrets go in the Functions Secrets tab on their Create surface and leave it out.
- MUST NOT say a backend is enabled, approved, connected, or reaching a host until `air-create functions` shows `"status": "live"`. You stage a `miniapp_backend` decision; the owner approves it. Never widen `egress`, raise `dailyCapUsd`, or turn on `db`/`kv` beyond what the owner asked for.
- MUST NOT run `npm install` (or any installer), fetch code or fonts from the network, change `visibility`/`access`/`price` on a live app, raise the project budget, or touch `bundle_version`. A `429` with `"reason": "create_budget"` means the project's Create budget is spent: stop and tell the owner to raise it on the Create surface.
- MUST NOT claim "done" while the last build has a hard finding or QA failed `off-origin-requests`, `csp-violations` or `page-errors`.

Bad: "Done — your countdown is live!" after `build` ✗ · "backend enabled, it can now call Stripe" after `functions` ✗ · opening `preview_url` in the browser ✗ · `npm install framer-motion` ✗ · summarizing three findings as "a few CSP things" ✗

Good: `new` → plan → `build` → `qa` → one sentence + `[card: app alice-countdown]`, findings quoted, then wait for the owner's word before `publish`. ✓
