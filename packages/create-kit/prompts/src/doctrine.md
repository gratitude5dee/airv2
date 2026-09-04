## 1. Doctrine

### The contract

A mini-app is one static bundle behind the Air CSP ceiling. Rules, not preferences:

- `index.html` at the bundle root; everything it loads is in the bundle. No host is ever referenced: no CDN script, no web font, no remote image, no `<iframe>`, no `<meta http-equiv>`, no analytics. The Build Service rejects a bundle that names a host.
- No client storage. `localStorage`, `sessionStorage`, `indexedDB`, cookies and service workers are forbidden; every app shares one origin, so anything persisted is readable by every other app. State lives behind `useAirState()` (the Apps API, 256 KiB per resource; owners write, guests read).
- No `eval(`, no `new Function(`, no inline event handlers, no `javascript:` URLs. `"use client"` where a component touches the DOM; nothing reads `window` at module scope.
- Messages viewport: `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`, single column ≤ 36rem, `min-height: 100svh`, `env(safe-area-inset-*)` padding, ≥ 44px (2.75rem) touch targets, 16px inputs so iOS does not zoom.
- Lite (`surface.lite`, `<html data-lite="1">`, `useLite()`): no `backdrop-filter`, no fixed backgrounds, DPR 1, no WebGL, no component marked `lite="false"`. Compact card (390×360) first; expanded (390×760) second; nothing depends on a desktop width.
- `prefers-reduced-motion: reduce` yields a static, complete frame. `useReducedMotion()` is the switch; every component in this Kit declares what it does under it (`reducedMotion` in the catalog).

### Air's visual system is data

Use tokens, never literals: `var(--canvas)`, `var(--ink)`, `var(--ink-muted)`, `var(--accent)`, `var(--on-accent)`, `var(--on-ink)`, `var(--panel-bg)`, `var(--well-bg)`, `var(--ring)`, `var(--shadow)`, `var(--blur)`, `var(--font-body)`, `var(--font-ui)`, `var(--radius-panel)`, `var(--radius-well)`, `var(--radius-pill)`, `var(--text-shadow)`, `var(--slide-in)`. `kit/air/theme.css` defines them for both themes; `kit/air/shell.css` gives the structural vocabulary (`.frame`, `header.bar`, `main.app`, `.panel`, `.notice`, `.row`, `.item`, `.card`, `.tile`, `.grid`, `.chip`, `.addrow`, `.tablewrap`, `.hero`, `.navlink`). Build screens from that vocabulary first and reach for a catalog component only where the recipe names one.

`atmosphere` is the default (Newsreader display over Azeret Mono labels, warm dark canvas, soft blur). `pixel` is the fallback (Inter/system, flat neutrals, no shader, no blur) and is what lite surfaces get. A component that only looks right under one theme is wrong.

### Motion

One hero motion per screen. Everything else settles in ≤ 300ms with an ease-out. Nothing moves on scroll inside a webview; no parallax, no scroll-linked reveals. Under reduced motion the hero is a static frame that already says everything. Loops are finite or explicitly `aria-hidden` decoration. Never animate `width`/`height`/`top`/`left`; use `transform` and `opacity`.

### Typography, density, copy

Display in `--font-body`, labels/buttons/counters in `--font-ui` with `.kicker` tracking. One display size per screen, body 16px, labels 12–13px uppercase. Touch first: single column, 44px rows, no hover-only affordance (hover may enhance, never reveal). Copy is short, present tense, no exclamation marks, no emoji in UI chrome. The owner's name and the app's purpose appear once, in the header pill.

### Data and identity

The app knows the viewer only as owner or guest, and learns which by trying to save: `useAirState().canWrite` is `null` until a write is attempted, `false` after a 403. Show guests the same screen, read-only, without a broken control. No secrets in `src/`; Functions secrets live in the Secrets tab and are read server-side only.
