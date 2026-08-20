# air 2.0 — Home & App Store Redesign Spec ("Pixel OS")

**Date:** 2026-08-20 · **Status:** for sign-off (no code changed yet) · **Mockups:** `docs/review-2026-08/mockups/pixel-os-mockup.html` (interactive: Home / App Store / Settings screens)

Everything in this spec is mapped to the code as it exists today (file:line references are to the current tree) and respects the ten hard constraints inventoried in §8. Baseline is green (typecheck, 681 tests, lint), so the redesign starts from a safe floor.

---

## 1. Design direction — "Pixel OS"

The brief: make the app — and especially the App Store — feel like an **early-2000s handset app store** (Sony Ericsson-era: T610/K700 menu grids) without cosplaying as a dead phone. The good news is the codebase already owns the raw material: `components/dither-kit/pixel.ts` ships a 4×4 Bayer ordered-dither engine with deterministic seeds and bloom; `DitherAvatar` draws mirrored 8×8 pixel glyphs with `image-rendering: pixelated`; `DitherButton` (pixel outline, live dither fill, mono label) is fully built and **imported by zero files**; `DitherGradient` washes already brand the login/marketing/store pages — just never `/home`. The redesign's job is to promote this dormant retro layer from accessory to system.

The language, in five rules:

1. **Hard pixels over soft blur.** 1px solid outlines (`--text` at full strength) replace hairline rings on interactive elements; corners tighten from 999px pills to 6–10px; shadows become 2px hard offsets (`box-shadow: 2px 2px 0 var(--ring)`), not gaussian glows. `.panel` keeps its 12px card body but gains a crisp 1px border.
2. **Dither is the texture of the brand.** Section headers, progress meters (the spend meter at `page.tsx:3123` already does this), app-icon backplates, and hover fills all use the Bayer engine. Gradients are *dithered* gradients (`DitherGradient`), never smooth CSS gradients.
3. **Two voices of type.** Inter stays for prose/body (it's everywhere and it's good). All *system chrome* — nav labels, buttons, section headers, status lines — switches to the mono stack (`ui-monospace`) in 10–11px uppercase with 0.08em tracking, like a handset status bar. No webfont dependency needed.
4. **Icons are drawn on an 8×8 grid.** One `PixelIcon` component (SVG `<rect>` grid or canvas, `image-rendering: pixelated`, currentColor) replaces lucide in the nav and app tiles; lucide survives inside dense panel bodies. Every mini-app gets a deterministic pixel icon fallback from its slug via the existing `DitherAvatar` hash — uploaded publisher icons (`icon_key`, stored today but shown only in OG tags) render inside the same 1px-outlined tile chrome.
5. **Glossy exactly once per screen.** The era's signature — a subtle top-edge specular band — appears only on the App Store featured banner and on app-icon tiles (a 1px lighter inner-top border), never on body panels. Restraint is what separates "award-worthy retro" from "theme park."

Both color schemes survive: tokens stay in `globals.css` `@theme`, `prefers-color-scheme` keeps working, `prefers-reduced-motion` opt-outs already in orb/dither/rise-in are preserved. New tokens: `--outline` (1px border color = `--text` @ 85%), `--shadow-hard: 2px 2px 0`, `--chrome-top` (specular), plus the existing dither palette seeds.

## 2. Information architecture — old → new

Today: a flat 13-tab rail (`TABS`, `page.tsx:293-307`), Profile + Plugin Sign-In + Speed + quick-launch stranded in a static right rail. New: **four groups + Settings**, mapping every existing surface (nothing is deleted):

| New nav | Contains | Source today |
|---|---|---|
| **AIR** | **Computer** (collapsible, above Chat) · **Chat** (+ New thread, thread list) | Computer tab (`2380-2519`) · Chat (`2809-2973`) |
| **APPS** | **App Store** · **Installed** · **Ads** (as a mini-app) · **Mini-App Creator** | store pages (`app/mini/(store)`) · apps-panel · ads-panel/wizard/analytics · new (wraps publish pipeline) |
| **PERSONAL** | **Needs You** · **Calendar** · **History** · **People** · **Context** (new) | needs (`1552-1848`) · calendar-panel · history (`2080-2207`) · people (`1849-1958`) · new (mounts built-but-dark memory/traces/onairos sections) |
| **BANK** | **Wallet** · **Vault** · **Payments** *(coming soon)* · **Card** *(coming soon)* | wallet (`2520-2778`) · vault-panel · `payment_requests` backend exists (pay mini-app) · placeholder |
| **SETTINGS** (pinned bottom) | Profile + Plugin Sign-In (side by side) · tabs: **Connectors** · **Skills** | right-rail account card (`2978-3030`) + `PluginPanel` (`3074`) · connectors (`1959-2079`) · skills (`2208-2379`) |

Bots fold into **AIR** as a chat affordance (the `@mention` palette already delegates runs to bots, `page.tsx:514-526`; the roster/rooms management screen moves to `AIR → Chat → Bots` drawer) — the left rail loses its 13th item without losing the feature. Browser (today a Computer subtab) stays a Computer subtab.

Nav state moves from `useState` to the URL (`/home?s=air.chat`, shallow routing) — fixes deep-linking/refresh/Back (tech-debt D5) and gives the cross-tab imperative jumps (`onAskAgent`, `calendarPrefill`, "Open Needs you") stable targets.

## 3. AIR — the primary surface

**Layout.** Left rail 168px (grouped, mono labels, pixel icons). Center column is the Air surface; right rail 280px keeps **Speed & Intelligence** and gains the **Apps launcher** (§6).

**Computer above Chat, minimizable.** The live desktop iframe (`/api/box/desktop`, remounted via `computerEpoch` — `page.tsx:319,462,753,1330`) docks as a card at the **top of the center column**, replacing both today's separate Computer tab body and the inline mid-chat iframe (`2897-2942`). Three states, persisted in the URL/localStorage:

- **Expanded** — 16:10 viewport, title bar `⏻ COMPUTER · <status>` with Keep-awake 1h, Snapshot, Open in new tab, VNC (all existing endpoints: `/api/box/{wake,stop,desktop}`, `/api/computer/{screenshot,keepawake,history}`).
- **Minimized** — a 32px status strip: power dot (fed by the existing adaptive `/api/box/status` poll, `412-438`), box state copy, and an expand chevron. The strip **auto-expands** when an SSE `tool.started` names a `browser*/computer*` tool (existing latch logic, `745-756`) — same behavior, better home.
- **Hidden** — strip only appears while the box is `starting/stopping` (boot banner `2943-2952` merges into the strip).

`ScreenExtras` (power sparkline, keep-awake schedules) and the Browser subtab live behind a "⋯ details" flip on the expanded card.

**Threads.** Today chat is the single shared `air-main` session (`536-570`) with no thread UI — but the box already exposes the sessions API the History tab uses (`GET /api/box/api/sessions`, `GET .../sessions/{id}/messages`, `DELETE`). "New thread" becomes real with one small, honest API addition: accept an optional `session` field on `POST /api/chat` (validated `air-[a-z0-9-]{1,32}`, default `air-main`) and thread it through `startChatRun` → Hermes run creation (`lib/chat/relay.ts:36`). The left rail's AIR group then shows: `+ New thread`, the pinned **Main** thread (`air-main`, shared with iMessage — labeled with an iMessage glyph so the user knows it's the phone thread), and recent web threads (from the sessions list, channel-filtered). History remains the read-only archive of *all* channels; deleting a thread reuses the existing session DELETE. Bot chats and Rooms mount as drawer views inside AIR (existing `bots-panel` SSE plumbing unchanged).

**Chat panel** keeps the composer contract exactly (5 attachments, 100MB chunked, voice 300s, `/commands`, `@mentions` — `PromptInput` untouched in phase 1) and inherits the full-height column now that the fixed `h-[72vh]` wrapper (`1551`) dies with the tab ternary.

## 4. APPS — the store as the showpiece

**App Store** (in-app screen wrapping the existing store data — `GET /api/mini/apps`, store index projection, `POST /api/mini/link`):

- **Featured banner**: full-width dithered gradient (existing `DitherGradient`, store already uses it) with a glossy top band; rotates 2–3 first-party apps.
- **Category pills** (mono, uppercase) — fix the dead "Work" category first (kanban/todo are `private` in 0034; either flip public or drop them from `CATEGORIES` — miniapps finding 17).
- **The grid**: 4-up (desktop) chunky icon tiles, 64×64 icon in a 1px-outlined rounded-8px tile with specular top edge and hard 2px shadow; deterministic pixel-glyph fallback (DitherAvatar hash) when a publisher hasn't uploaded an icon; uploaded icons (`icon_key` → `publicUrl()`) render pixel-fit. Mono label under each tile, price/gate badge (`$0.50` / `🔒` / `FREE`) top-right like a signal indicator. Selection ring is a 2px dither-animated marquee (Bayer phase shift — `pixel.ts` PRNG makes this ~20 lines).
- **Detail sheet**: icon + name + publisher + gates (from the same registry row the `agent.md` projection uses), Open (→ §6 in-chat load), Install/pin (`POST /api/mini/install`), earnings chip for the owner.
- Store search backs onto the existing `/api/store/search` (also the fix for LaunchButton's dead 402 path — route 402s to the pay page, miniapps finding 9).

**Installed** — today's `apps-panel.tsx` list, restyled as tiles with the same chrome; keeps install/uninstall + launch (single shared `launchMiniApp` helper — consolidating the two divergent implementations, tech-debt D12).

**Ads becomes a mini-app.** ads-panel/deploy-wizard/analytics (~90KB of panel code) move out of the left rail into `lib/miniapps/apps/ads.tsx` (owner-only registry row, `kind: render`, same decision-gated `ad_writes` flow — the wizard already only *proposes*; approvals stay in Needs You). Phase 1 simply re-homes the entry point under APPS (tile opens the existing panel in the center column); phase 2 ports it to the mini-app runtime so it's also reachable from iMessage as a card (`card_sends` kind `ads` already registered — dead kind #11 comes alive). Spend-ceiling gating (`spend_ceiling_cents === 0` blocks writes, ads-panel:495-500) surfaces as a tile badge.

**Mini-App Creator** — new, honest scope: a guided 4-step builder over the pipeline that already exists end-to-end: (1) name + appname (reserved-word validation from `reserved.ts`, slug preview `<username>-<appname>`), (2) icon upload (MA8 guard route), (3) bundle zip upload (validator caps surfaced in-UI) *or* "start from a template" (ship 2 template zips: static page, Apps-API todo), (4) gates — visibility, password, price, plugin sign-in — **requires the P0-4 PATCH endpoint** (the ~100-line unlock in the review), then publish (existing status flip + decision). The store session/publish surface (`app/mini/(store)/publish/page.tsx`) already proves every call.

## 5. PERSONAL and BANK

**Needs You** keeps its universal-approval role (constraint #1) and gains: group-by-kind chips (exists), a fixed CTA map replacing the 5-deep ternary (`1785-1800`), and a generic approve fallback so unknown kinds are never mislabeled "New contact" (tech-debt D4 — today a wallet approval can render as "New contact" with no approve button). A global rail badge shows the pending count on every screen (poll already exists on tab entry; lift to the layout).

**Calendar / History / People** move unchanged in phase 1 (they're already extracted components or self-contained blocks). Calendar's persona colors get swatches; History gains a "continue in new thread" action (seeds a thread from a session id — free with §3 threads).

**Context** (new) — "what your agent knows," assembled from three **built-but-unmounted** modules (miniapps finding 5): memory files (`lib/memory/files.ts` + `sections/memory.tsx`), trace receipts + export (`lib/traces/receipts.ts` + `sections/traces.tsx`, needs the two P1-6 indexes before it ships), and Onairos persona (`lib/onairos/sync.ts` + `sections/onairos.tsx`). One screen, three cards. This is the cheapest "new feature" in the whole spec — it's wiring.

**BANK** = Wallet + Vault as-is (vault's emoji glyphs → PixelIcons, D19), plus two **coming-soon tiles** that are real previews, not vapor: **Payments** previews the `payment_requests` queue (backend + pay mini-app exist; the tile deep-links to the pay mini-app until a native panel lands) and **Card** is a static roadmap tile (dither-gradient card mock, "Card — coming soon"). Wallet's Send stays request-only → Needs You (constraint #1, and the P0-1 fix lands underneath it).

## 6. Right rail — Speed & Intelligence + Apps-in-chat

The rail slims to two cards:

1. **Speed & Intelligence** — existing tier control + spend meter (`3076-3134`), restyled (dither meter stays; it's already the most on-brand element in the app). The duplicate tier picker inside the composer's "+" menu is removed (one source of truth, tech-debt constraint #8).
2. **Apps** — a 3×3 grid of installed-app pixel tiles (replaces today's 3-item quick-launch card, `3032-3072`). **Click = load in chat**: the app opens as a docked panel inside the center column (a sandboxed iframe on `mintSignedLink` URL — exactly the mechanism today's new-tab launch uses), with "open in new tab ↗" as the escape hatch. **Prerequisite (small, real):** first-party app pages send `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` (`lib/miniapps/html.ts:11-13`) — add `env.appOrigin()` to frame-ancestors and drop XFO on those responses, which is precisely what goal.md §4.3.2 already specifies (published bundles allow the app origin already, `published.ts:31`). Fallback: any app whose CSP still refuses framing opens in a new tab automatically (listen for the iframe load failure).

Profile, Plugin Sign-In, and the old quick-launch card leave the rail (→ Settings / Apps).

## 7. SETTINGS

Route `/home?s=settings` (rail bottom, gear PixelIcon). Top row: **Profile** card (avatar, username + save w/ cooldown errors — `911-927`, iMessage line, agent email, `/@handle` link, wallet snippet, sign out) and **Plugin Sign-In** (`PluginPanel` verbatim) **side by side**. Below, two tabs (mono, uppercase): **CONNECTORS** — the existing panel including its OAuth full-redirect + resync-on-entry contract (constraint #7); **SKILLS** — the existing hub/installed/detail-sheet panel. Both move essentially unchanged; they were already self-contained blocks in the ternary.

## 8. Hard constraints honored (from the code audit)

1. Needs You stays globally reachable (rail badge) — it's the safety architecture; all cross-links into it survive.
2. Box status poll (adaptive 3s/15s) and 429-vs-502 wake copy keep working; sleep-aware empty states everywhere.
3. The desktop iframe stays remount-keyed on `computerEpoch`; wake/token rotation, "Open in new tab", VNC all preserved.
4. `air-main` remains the shared web+iMessage session; threads are additive (new sessions), never a rewrite of the main one.
5. Cross-surface payloads (Ads→Chat prefill, Calendar→Chat dispatch, Browser→Calendar prefill) get explicit channels in the new layout (URL params/state lifted to the layout).
6. Nav becomes URL-driven; the 13-way ternary and `TABS` array are retired together.
7. Connector OAuth redirect/resync flow unchanged.
8. Composer contracts (attachments/voice/commands/mentions) untouched in phase 1; tier picker consolidated.
9. Ads stays server-side spend-gated; Meta still routes to chat by design.
10. dither-kit is extended in place (it's registry-packaged); `prefers-color-scheme` and `prefers-reduced-motion` behavior preserved.

## 9. Implementation plan (phased, each phase shippable + typecheck/test green)

**Phase 0 — prerequisites (small PRs):** frame-ancestors fix (`html.ts`); `launchMiniApp` helper; P0-4 gate-settings PATCH; store category fix; P1-6 indexes; generic decision CTA fallback (D4).

**Phase 1 — shell:** new `app/home/` layout: `nav.tsx` (grouped rail, PixelIcon set, URL state), `air/computer-card.tsx` (3-state dock, absorbs Computer tab + inline iframe + boot banner), right rail (`speed-card`, `apps-grid` with in-chat dock). Chat/threads: `session` param on `POST /api/chat` + thread list. Each old tab body extracted verbatim into `panels/*.tsx` (mechanical split of the ternary — kills the god component; each extraction is diffable and revertable). Bots → AIR drawer.
**Phase 2 — Pixel OS skin:** tokens (`--outline`, hard shadows), PixelIcon set (~18 glyphs), DitherButton adoption for primary actions, mono chrome type, App Store screen (banner/categories/grid/detail), Installed tiles, Settings screen assembly, Context screen (mount the three sections).
**Phase 3 — Apps depth:** Ads re-home then port to mini-app; Mini-App Creator; Payments preview tile; store icons rendering; session-expiry page; StartLimit wraps in kanban/todo/image/video; prompt bar in the shared app shell.
**Phase 4 — debt burn-down in the new files:** SSE cleanup on unmount (D2), ads zombie poller (D3), stable message ids (D11), aria-live chat log (D9), dialog focus traps (D10), stale-while-revalidate per panel (D6), stick-to-bottom-only-when-at-bottom (D8).

**Definition of done per phase:** `npm run typecheck` + `npm run test` + `npm run lint` green; no API contract removed; every existing endpoint call preserved or explicitly replaced; visual QA against the mockup.

## 10. UI tech-debt register (carried from the audit; fixed by phase noted)

D1 god component (P1) · D2 SSE unmount leak (P4) · D3 ads zombie poll (P4) · D4 unknown decision kinds mislabeled (P0 quick fix) · D5 no URL state (P1) · D6 inconsistent staleness (P4) · D7 naked fetches without catch (P1, as panels are extracted) · D8 scroll yank (P4) · D9 no aria-live (P4) · D10 no focus traps (P4) · D11 index keys (P4) · D12 duplicate launch impls (P0) · D13 dead DitherButton (P2 — adopted) · D14 duplicated `isComputerTool` (P1) · D15 ref-below-effect (P1) · D16 optimistic power state stuck (P1) · D17 timer leaks (P4) · D18 vestigial `active` prop (P1) · D19 emoji icons in vault (P2) · D20 dead `usd` field (P1).

---

*Companion docs: `01-engineering-review.md` (platform findings this spec depends on), `02-miniapps-review.md` (per-app design pass + feature backlog). Interactive mockup: `mockups/pixel-os-mockup.html`.*