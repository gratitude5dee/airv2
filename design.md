# Design system — themes and tokens

The visual system is **data, not markup**. A theme supplies values; renderers only
reference token names. Adding a theme (liquid glass, a colour-gradient palette, a
light mode) means adding an entry to `THEMES` — no renderer changes, no new CSS
files, no per-component overrides.

Source of truth: `apps/web/lib/miniapps/themes.ts`.
First consumer: the ten-slide onboarding mini-app
(`apps/web/lib/miniapps/apps/onboarding.tsx`).

## The contract

```ts
THEME_IDS = ["atmosphere", "pixel"];   // ThemeId
DEFAULT_THEME = "atmosphere";

interface Theme {
  id: ThemeId;
  name: string;             // shown in the Settings selector
  description: string;      // one-line subtitle in the selector
  tokens: ThemeTokens;      // emitted as :root custom properties
  backdrop: ThemeBackdrop;  // what paints behind the content
  fontStylesheet: string | null; // web font to link, null = system type only
}
```

`isThemeId(value)` is the narrowing gate: anything arriving from a query string,
a cookie, or a settings row goes through it before `theme(id)`.

### Tokens

Every theme fills the whole set. `tokenBlock(tokens)` emits them as
`--kebab-case` custom properties on `:root`; a renderer may only use
`var(--token)`, never a literal colour, radius, family, or duration.

| Token | CSS var | Meaning |
| --- | --- | --- |
| `canvas` | `--canvas` | Page canvas behind the backdrop layer |
| `ink` | `--ink` | Primary text, and the fill of solid controls |
| `inkMuted` | `--ink-muted` | Secondary text: helper copy, eyebrows, inactive dots |
| `onAccent` | `--on-accent` | Text on an `accent` fill (notices) |
| `onInk` | `--on-ink` | Text on an `ink` fill (solid buttons) |
| `accent` | `--accent` | Focus rings, active step, links, notices |
| `panelBg` | `--panel-bg` | Elevated surface fill: slide panel, header pill, nav pill |
| `wellBg` | `--well-bg` | Inset surface fill: inputs, rows, code blocks |
| `logoPlate` | `--logo-plate` | Plate behind the wordmark (the mark is dark chrome art) |
| `scrim` | `--scrim` | Layer over the backdrop, under the content; `none` for flat themes |
| `ring` | `--ring` | Hairline border on every surface |
| `shadow` | `--shadow` | Elevation shadow for panels and pills |
| `blur` | `--blur` | `backdrop-filter` on elevated surfaces (`none` is valid) |
| `fontBody` | `--font-body` | Display/body family |
| `fontUi` | `--font-ui` | Eyebrow/UI family: labels, buttons, counters |
| `radiusPanel` / `radiusWell` / `radiusPill` | `--radius-*` | Corner radii by surface class |
| `textShadow` | `--text-shadow` | Shadow behind display text; `none` for flat themes |
| `slideIn` | `--slide-in` | Slide entrance duration; `0ms` disables the animation |

Three tokens exist because of hard-won rendering lessons, and a new theme must
not skip them:

- **`logoPlate`** — the WZRD wordmark is dark chrome artwork. On a bright or busy
  backdrop it disappears without a light plate under it.
- **`scrim`** — an animated backdrop goes bright in places. The scrim keeps body
  text at a readable contrast wherever the backdrop lands. Flat themes set
  `none` and the renderer omits the layer entirely.
- **`textShadow`** — a headline over moving clouds needs its own shadow, and the
  same shadow over a flat canvas reads as a smudge. `none` on flat themes.

`onAccent` and `onInk` are separate on purpose: a solid button is an `ink` fill,
a notice is an `accent` fill, and in a light-ink theme those need opposite text
colours.

### Backdrop

```ts
type ThemeBackdrop =
  | { kind: "shader"; script: string; element: string; grain: boolean }
  | { kind: "css"; grain: boolean };
```

A shader backdrop names a **self-hosted** script and the custom-element markup
it defines; the renderer positions it fixed behind everything and paints the
scrim and optional film grain above it. A `css` backdrop paints `canvas` only.

`grain` is not only cosmetic: the overlay is a `data:` SVG background image, and
CSS background images are governed by `img-src`, so `themeCsp()` widens `img-src`
to `'self' data:` exactly for the themes that draw grain.

## Themes today

### Atmosphere (default)

The WZRD Creator OS look. The fBm cloud + light-ray GLSL field from the landing
page (`/creator-os/fx.js`, `<wz-sky>`) behind dark glass panels, Newsreader
display over Azeret Mono labels, cream ink on atmospheric blue, film grain, a
620ms slide entrance.

### Pixel

The in-app Pixel OS surface expressed as a theme: Pixel neutrals lit by a
gradient canvas (a cool accent glow off the top edge, a violet wash at the upper
left, a dimmer glow off the bottom), system type, no backdrop layer, no grain, no
entrance animation, no external fonts. It is
both the calm alternative and the safe fallback — everything renders with zero
network dependencies and zero WebGL.

## Constraints a new theme must respect

1. **Fill every token.** The type makes this non-optional; a partial theme is a
   compile error, not a visual bug found later.
2. **Self-host backdrop scripts.** `themeCsp(theme)` widens the strict mini-app
   CSP baseline (`default-src 'none'`) by exactly what the theme needs — a
   shader adds `script-src 'self'`, a web font adds
   `style-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com`,
   a flat theme adds nothing. A theme that wanted a third-party script would have
   to widen the CSP, so it is not allowed.
3. **Degrade to legible.** If the backdrop fails (no WebGL, blocked script,
   reduced motion), the page must remain fully usable: `canvas` carries the look
   on its own, and the shader element is decorative and `aria-hidden`.
4. **Honour `prefers-reduced-motion`.** The renderer drops slide entrances and
   `fx.js` stops animating; a theme must not reintroduce motion in a token.
5. **No literals in components.** If a surface needs a value the tokens can't
   express, add a token to the contract — do not hard-code it in a renderer.

## Switching themes

The theme is resolved in one place per surface:

```ts
function activeTheme(ctx: MiniAppContext): Theme {
  const requested = ctx.request.nextUrl.searchParams.get("theme") ?? "";
  return theme(isThemeId(requested) ? requested : DEFAULT_THEME);
}
```

Today that seam reads `?theme=<id>` (which navigation preserves), so themes are
reviewable before there is any persistence. A Settings selector replaces the
body of `activeTheme` and nothing else:

1. Store the chosen `ThemeId` on the user's settings row (validated with
   `isThemeId`, defaulting to `DEFAULT_THEME`).
2. Have `activeTheme` read that value, with the query string kept as an
   override for preview.
3. Render the selector from `THEMES` — `name` + `description` per option — so a
   new theme appears in Settings with no UI work.

## Adding the liquid-glass / gradient variants

Each planned variant is one entry in `THEMES`:

- **Liquid glass** — high `blur`, translucent `panelBg`/`wellBg`, bright `ring`,
  a `css` gradient backdrop or a shader of its own, larger radii.
- **Colour-palette variants** — same surface geometry and type, different
  `canvas`/`accent`/`ink` families. When several palettes share one structure,
  build them from a shared base object and override only the palette tokens, so
  "palette" and "design pattern" stay independently swappable.

If a variant needs a knob that doesn't exist yet (a gradient angle, a texture
opacity), add it to `ThemeTokens` and give every existing theme a value in the
same change. The contract is the thing that keeps the surfaces honest.
