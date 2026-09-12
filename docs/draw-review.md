# /draw mini-app review — airv2 vs mayor-coast

Compares the mayor-coast COAST Draw mini-app against the airv2 port. Mayor-coast side read at `edff74b` (`src/app/draw/**`, `src/lib/draw/**`, `src/app/api/draw/**`, `e2e/draw-layout.spec.ts`, `tests/draw-*.test.ts`, `ios/CoastDraw/`); airv2 side at `main` `9732e3c` (`apps/web/lib/miniapps/apps/draw.tsx`, `apps/web/lib/miniapps/client/draw-studio.tsx`, `apps/web/lib/miniapps/draw.ts`, `apps/web/lib/miniapps/drawCommand.ts`, `supabase/migrations/0107_draw_miniapp.sql`).

Severity and effort follow `review.md` conventions: P1 materially degrades the product, P2 worth scheduling, P3 hygiene; S under a day, M one to three days, L more. Findings carry `DR-##` IDs and `file:line` evidence.

## TL;DR

The port carries the complete feature skeleton — dual-canvas raster editor, palette/eraser/size, image import, revision strip, refine/reset-context, generate → animate → send, and the `/draw` iMessage lane — but it **dropped the gesture-confinement layer mayor-coast built specifically for the Messages webview**. That is the reported accessibility bug: DR-01/02/03 are one root cause in three parts and should land together. The rest is parity work: keyboard/ARIA gaps (DR-04), preview-state handling (DR-05), pointer hardening (DR-06), and three port decisions that need an owner call (tldraw, effects, preview streaming).

| ID | Finding | Sev | Effort |
|----|---------|-----|--------|
| DR-01 | Draw strokes scroll the whole mini-app — the webview touch fallback was not ported | P1 | S |
| DR-02 | Studio is not viewport-bound — page scrolls, square overflows short screens | P1 | S |
| DR-03 | No `visualViewport` tracking — keyboard open/close slides the layout | P1 | S |
| DR-04 | Keyboard/ARIA parity gaps: roving tabindex, arrow keys, `aria-live` on the message line | P2 | S |
| DR-05 | Preview not decode-gated; poll-delivered results never auto-reveal | P2 | S |
| DR-06 | Dropped pointer hardening: `onLostPointerCapture`, context-menu guard, `stopPropagation`, point clamp | P2 | S |
| DR-07 | Canvas-zone gutters scroll the page (no `touch-action:none` on the zone) | P2 | S |
| DR-08 | Generate stays enabled on the Preview tab | P3 | S |
| DR-09 | Decision needed: tldraw licensed editor not ported | P3 | — |
| DR-10 | Decision needed: GlowCursor pencil trail / Silk / GhostFibers effects not ported | P3 | — |
| DR-11 | No `data-testid` hooks — mayor-coast's `draw-layout.spec.ts` can't be ported as-is | P3 | S |
| DR-12 | Generate/animate run as one blocking POST for the whole render | P2 | M |

## The reported bug — "while user draws, the mini-app slides up and down"

One mechanism explains it: **the airv2 studio lives inside a scrollable document, and nothing owns a draw gesture end-to-end.** Mayor-coast hardened exactly this path over two commits (`d2d0cbe` "Keep COAST Draw inside Messages", `016abd4` "Harden Draw canvas interactions in Messages webview") and pins it in e2e (`draw-layout.spec.ts` — "drawing changes the custom canvas without scrolling the mini-app" asserts `window.scrollY === 0` mid-stroke). All three defenses were lost in the port:

### DR-01 — P1, S — the sheet-gesture fallback was not ported

Messages-extension webviews ignore `touch-action` while their sheet pan gesture is live, so CSS alone cannot hold a draw stroke. Mayor-coast therefore owns the gesture in JS — non-passive `touchstart`/`touchmove` listeners on the canvas zone that `preventDefault()` a gesture that began on the canvas, deliberately excluding the utility rail (`mayor-coast/src/app/draw/[sessionId]/draw-studio.tsx:221-247`). airv2 has no equivalent anywhere: only `touch-action:none` on `.ds-viewport`/`.ds-layer` (`draw-studio.tsx:1085-1086`), which is the property the webview ignores in exactly this scenario. A vertical stroke that starts on the canvas becomes a sheet/page drag → the app slides.

### DR-02 — P1, S — the studio can outgrow the viewport

Mayor-coast's shell is a fixed, non-scrolling app frame (`draw-studio.tsx:518-519`):

- `html,body { height:100%; overscroll-behavior:none }`
- `.draw-shell { height:var(--coast-draw-vvh,100dvh); overflow:hidden; display:grid; grid-template-rows:auto minmax(0,1fr) auto auto }` — the canvas zone is `minmax(0,1fr)`, so it absorbs leftover space and can never push the page taller
- `.viewport` gets its square edge from a `ResizeObserver` writing `--coast-draw-canvas-edge` = `min(workspace.width, workspace.height, 720)` (`:261-267`), so the square always fits the *available* space
- `.bottom-sheet { max-height:min(34dvh,250px); overflow:auto; overscroll-behavior:contain }` — controls scroll internally instead of growing the page

The airv2 shell instead renders a normal document flow: `body{min-height:100svh}` and `.frame{min-height:100svh}` (`shell.ts:33,37`), then `main.app` stacks `header.bar` + kicker + `h1` + the studio. The studio itself is `.ds-root{flex:1}` → `.ds-canvas-zone{flex:1}` → `.ds-viewport{width:min(100%,26rem);aspect-ratio:1}` (`draw-studio.tsx:1067,1084-1085`) — sized by width only, with **no `max-height`** and no height observer. On a compact phone the stack (bar + headline + toggle + square + ink controls + sheet) is taller than the viewport, so the document is genuinely scrollable and every vertical draw stroke competes with page scroll. Even a fully `touch-action`-compliant browser still slides on drags that begin in the `.ds-canvas-zone` gutter (DR-07) or anywhere outside the canvas.

### DR-03 — P1, S — no `visualViewport` tracking

Mayor-coast writes `--coast-draw-vvh` from `window.visualViewport.height` on every resize (`draw-studio.tsx:249-255`), so the iOS keyboard opening over the prompt textarea shrinks the app frame instead of pushing the page and bouncing it when the keyboard closes. airv2 drops this entirely; in a scrollable shell the keyboard raises/lowers the visible region — the same "slides up and down" symptom whenever the prompt gets or loses focus.

## Parity gaps

### DR-04 — P2, S — keyboard and ARIA

- Mayor-coast implements the tabs/radiogroup APG patterns: roving `tabIndex` plus Arrow/Home/End on both the Sketch/Preview tablist (`viewKeyDown`, `:485-492,509-510`) and the mode picker (`modeKeyDown`, `:493-501,516`). airv2 keeps the roles (`role="tablist"`, `role="radio"`) but drops roving tabindex and all key handlers — every control is its own tab stop and arrows do nothing (`draw-studio.tsx:795-816,980-995`).
- The user-facing message line lost `aria-live="polite"` — mayor-coast `:516` announces errors/status; airv2 `.ds-message` (`:1057`) is silent to screen readers (`.ds-status` and `.ds-mode-caption` kept theirs).
- Tabs lost `aria-controls="draw-canvas-panel"` and the sketch layer stack lost its `aria-hidden` switch when Preview is shown (mayor-coast `:509-510,514`).

### DR-05 — P2, S — preview state handling

- Mayor-coast only enables/auto-opens Preview after the image actually decodes (`decodedPreview` + a hidden `preview-preload` `<img>`, `:467-483,514`); a URL that fails to load surfaces a message instead of a broken image. airv2 enables on URL presence alone (`:811,866-876`).
- Auto-reveal only fires on the direct generate/animate response (`:643-646,695-698`). If the render lands via the 2.5 s poll — e.g. the POST was aborted or the app was reopened mid-job — `previewUrl` updates but the tab stays on Sketch with no indicator. Mayor-coast auto-opens once per new job unless the user already chose a view (`autoPreviewEligibleJobIdRef`/`explicitViewJobIdRef`, `:76-78,113-116,477-482`).
- Mayor-coast resets Sketch scroll state and clears `decodedPreview` on new jobs; minor, folded into the same fix.

### DR-06 — P2, S — pointer hardening dropped

- `onLostPointerCapture={end}` (mayor-coast `:514`) — when the webview steals the gesture mid-stroke, airv2 leaves the live stroke dangling; `livePoints` is only flushed on pointerup/cancel (`:442-461`).
- `onContextMenu` suppression (`mayor-coast :514`) — iOS long-press callout can interrupt a stroke.
- `event.stopPropagation()` in start/move (`mayor-coast :341,353`) — airv2 bubbles pointer events to the canvas zone/parents.
- `canvasPoint` clamps to `[0,1024]` (`mayor-coast src/lib/draw/canvas.ts:34-39`); airv2's version doesn't clamp (`:103-106`) — captured drags past the edge record out-of-range points (visually clipped, but diverges from the exported-image contract).

### DR-07 — P2, S — canvas-zone gutters scroll

Mayor-coast puts `touch-action:none` on the whole `.canvas-zone` (`:519`), so letterbox space around the square is gesture-dead too. airv2 only covers `.ds-viewport`/`.ds-layer` (`:1085-1086`); `.ds-canvas-zone` is `overscroll-behavior:contain` but still scroll-tainted (`:1084`). Drags starting on the surrounding zone scroll the document — on a scrollable page (DR-02) this alone produces the reported slide.

### DR-08 — P3, S — Generate enabled on Preview tab

Mayor-coast disables Generate while `tab === "preview"` (`:516`), keeping the action tied to the visible surface. airv2 leaves it enabled (`:1016-1024`), so a user can burn a render while looking at a previous result.

### DR-09 — P3, decision — tldraw adapter not ported

Mayor-coast ships a license-gated tldraw editor as an alternative surface (`tldraw-adapter.tsx`, `COAST_DRAW_TLDRAW_ENABLED` + license key envs, staged — production stays on the custom raster canvas). airv2 has no equivalent path. Decide: skip deliberately (license + bundle weight inside the mini-app CSP) or port behind the same flag pattern.

### DR-10 — P3, decision — decorative layer not ported

`Silk` (WebGL backdrop), `GhostFibers`, and `GlowCursor` (temporary pencil-trail overlay) are absent. The GlowCursor trail is the only one that's draw-specific UX rather than ambient theming; all three pause during drawing/prompt-focus/reduced-motion in mayor-coast (`:504`, plus reduced-motion handling `:274-280`). airv2 substitutes the shared shell backdrop (`theme("pixel")`) — note that `renderShell` loads the user's active backdrop effect via `/creator-os/bg/bg.js` (`shell.ts:203-209`) with **no pause-while-drawing**, so a heavy shader effect animates through draw gestures where mayor-coast explicitly idles its effects. If the user's theme effect is expensive this is also a perf item, not just aesthetics.

### DR-11 — P3, S — no test hooks

Mayor-coast's e2e suite (`e2e/draw-layout.spec.ts`) keys on `data-testid="draw-canvas-viewport"`/`"draw-canvas"` plus its CSS hooks — including the no-scroll assertion that covers this exact regression. airv2's port removed the testids; add them back so the layout spec (or a Vitest/jsdom equivalent of it) can run against the port.

### DR-12 — P2, M — generate/animate are one blocking POST

`action: "generate"` runs `runDrawJob` to completion inside the request (`apps/draw.tsx:209-222`); the render's whole duration is a single held POST (same for `animate`, `:229-241`). Progress still reaches the client via the parallel 2.5 s poll, but the request itself is exposed to function timeouts and Safari/webview aborts mid-render — in which case the delivered result arrives silently via DR-05's gap. Mayor-coast submits and returns immediately, streaming events over SSE. If the GMI lane ever gets a non-blocking admission this should flip to submit+poll; until then it's worth a comment in the action and a client-side catch that treats an aborted generate as "keep polling" rather than a failure line.

## Intentional divergences — verified, keep as-is

- **No browser storage.** mayor-coast persists the selected revision in `sessionStorage`; airv2 drops it deliberately — the mini-app contract forbids browser storage (C17). Server-side `revisions` + `latest`/`activeJob` pointers cover reload.
- **Poll instead of SSE/partials.** GMI delivers the finished render only; the ~2.5 s `status` poll is the documented substitute for mayor-coast's `EventSource` + `partial_image` stream. The `draw_events` feed (`kind in state|preview|completed`, migration `0107:40`) keeps the schema ready if a preview-capable lane ever lands.
- **Auth model.** mayor-coast exchanges a `#secret` launch hash for a session cookie; airv2 uses the platform's signed mini links (`mintSignedLink`, `drawCommand.ts:131`) — the platform contract, not a gap.
- **Mode → quality mapping.** `turbo`/`hq` are quality params on the imagine/edit lanes (`draw.ts:44-49`), not distinct provider models — the labels (`MODE_LABELS`) were kept, which arguably over-promises a distinct "Turbo" model; fine to keep but note the mapping is quality-only.
- **Save/Send semantics.** mayor-coast's `ready_for_save` state becomes airv2's `delivered` + explicit Send; airv2 additionally falls back to a signed download URL when Spectrum can't attach (`apps/draw.tsx:309-325`) — an improvement.
- **Cancel marks the job failed** server-side since GMI has no provider cancel (`draw.ts:665-686`) — documented, consistent.

## airv2-side improvements worth keeping (and worth backporting)

- HEIC/HEIF rejection with a concrete next step ("text it to me with /draw") (`draw-studio.tsx:544-575`) + server-side HEIC→JPEG transcode on the iMessage ingest path (`drawCommand.ts:101-108`).
- `<video>` preview for `mp4`/`mov` deliveries — animations are viewable in-app, where mayor-coast only previews stills (`draw-studio.tsx:866-877`).
- Dismissed-animation tracking so a poll can't resurrect an animation the user navigated away from (`:331-338,476-488`).
- PNG structural validation on upload (signature + IHDR + IEND, `draw.ts:869-881`) and sha256 dedupe to a content-addressed asset.
- `/draw` aliases `/sketch` `/paint`, attachment-first bursts, and auto-start on `/draw <prompt> [image]` (`drawCommand.ts:38-39,150-185`).

## Fix order

1. **DR-01 + DR-02 + DR-03 + DR-07 (S, one change):** pin the studio — `overflow:hidden` fixed-height region bound to `visualViewport.height` (a `--ds-vvh` equivalent), `overscroll-behavior:none` on `html,body` for this surface, `touch-action:none` on `.ds-canvas-zone`, `max-height:100%` + workspace-height-aware sizing on the square, `max-height` + internal scroll on `.ds-sheet`, and the non-passive `touchstart`/`touchmove` fallback on the canvas zone. Because the studio mounts inside the shared `renderShell`, the least invasive shape is scoping the pin to the draw body (the `#draw-studio` wrapper already carries `flex:1;display:flex`) rather than editing `SHELL_CSS` for every app — or adding a `fixedViewport` shell option if other gesture apps (e.g. a future signature pad) need it.
2. **DR-06 (S):** restore `onLostPointerCapture`, context-menu suppression, `stopPropagation`, and point clamping — a twenty-line diff.
3. **DR-04 + DR-05 + DR-08 (S):** roving tabindex + arrow keys, `aria-live` on `.ds-message`, decode-gated Preview with auto-reveal on poll, disable Generate on Preview.
4. **DR-12 (M):** comment + aborted-request handling now; submit+poll when a non-blocking lane exists.
5. **DR-11 (S):** re-add `data-testid`s and port the no-scroll e2e assertion as a Vitest or Playwright check.
6. **DR-09 + DR-10:** owner decisions — tldraw license and the GlowCursor trail are the only items with real upside; Silk/GhostFibers can stay unported.
