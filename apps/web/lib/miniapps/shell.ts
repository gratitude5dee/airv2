/**
 * Shared mini-app design shell — the onboarding slide-deck look (themes.ts,
 * docs/design.md) generalized for every first-party app: cloud-shader
 * backdrop, scrim + grain, glass panels, Newsreader display over Azeret Mono
 * labels. Renderers emit plain server HTML into `renderShell` and return it
 * via `shellHtml`; everything visual comes from theme tokens (`var(--token)`).
 *
 * Card-opened sessions (Messages extension) get a lighter variant: the
 * shader stays (it is the brand), but backdrop-filter blur and the entrance
 * animation are dropped and the shader runs in its calmer mode — the
 * extension webview has a tight memory/GPU budget.
 */
import { NextResponse } from "next/server";
import { env } from "../env";
import { baseHeaders, esc } from "./html";
import { themeCsp, tokenBlock, type Theme } from "./themes";
import { activeBackground, activeTheme } from "./themeContext";

const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.93' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E";

/**
 * One stylesheet for every app surface. Touch targets are ≥44px (Apple HIG),
 * inputs are 16px+ so iOS never auto-zooms, and layout is a single column
 * that breathes on any phone width.
 */
const SHELL_CSS = `
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
html{background:var(--canvas);background-attachment:fixed}
body{min-height:100svh;background:transparent;color:var(--ink);font-family:var(--font-body);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.backdrop{position:fixed;inset:0;z-index:0;pointer-events:none;display:block}
.scrim{position:fixed;inset:0;z-index:1;pointer-events:none;background:var(--scrim)}
.grain{position:fixed;inset:0;z-index:1;pointer-events:none;mix-blend-mode:soft-light;opacity:0.15;background-image:url("${GRAIN_SVG}")}
.frame{position:relative;z-index:2;min-height:100svh;display:flex;flex-direction:column;gap:clamp(0.8rem,2.6vw,1.1rem);padding:calc(env(safe-area-inset-top,0px) + clamp(0.9rem,3.2vw,1.35rem)) clamp(1rem,4.5vw,1.7rem) calc(env(safe-area-inset-bottom,0px) + clamp(0.9rem,3.2vw,1.35rem))}
header.bar{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;font-family:var(--font-ui)}
.logo-pill{display:inline-flex;align-items:center;height:clamp(2.7rem,9vw,3.4rem);padding:0 clamp(0.85rem,3vw,1.25rem);border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--logo-plate);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow)}
.logo-pill img{display:block;height:clamp(1.2rem,4.4vw,1.6rem);width:auto}
.app-pill{display:inline-flex;align-items:center;height:2.2rem;padding:0 0.9rem;border-radius:var(--radius-pill);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink)}
main.app{flex:1;display:flex;flex-direction:column;align-items:center;animation:riseIn var(--slide-in) cubic-bezier(0.22,1,0.36,1)}
@keyframes riseIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){main.app{animation:none}button,.navlink,.tile{transition:none}}
.kicker{font-family:var(--font-ui);font-size:clamp(0.68rem,0.8vw,0.85rem);letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin:0 0 0.7rem;text-align:center}
h1{font-weight:400;font-size:clamp(1.8rem,5.2vw,3.2rem);letter-spacing:-0.045em;line-height:0.98;margin:0 0 1.1rem;text-align:center;max-width:26ch;text-shadow:var(--text-shadow)}
.panel{width:min(100%,36rem);border-radius:var(--radius-panel);border:1px solid var(--ring);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow);padding:clamp(1rem,3.4vw,1.5rem);margin-bottom:0.9rem}
.notice{width:min(100%,36rem);margin:0 0 0.8rem;font-family:var(--font-ui);font-size:0.72rem;line-height:1.45;letter-spacing:0.04em;color:var(--on-accent);background:var(--accent);border-radius:var(--radius-well);padding:0.55rem 0.8rem}
h2{font-family:var(--font-ui);font-size:0.66rem;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-muted);margin:0 0 0.7rem}
h3{font-size:1.05rem;font-weight:500;margin:0.6rem 0 0.35rem}
p{font-size:1rem;line-height:1.5;margin:0 0 0.6rem}
a{color:var(--accent)}
.muted{color:var(--ink-muted);font-size:0.9rem}
button{position:relative;font-family:var(--font-ui);background:linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0) 55%),var(--ink);color:var(--on-ink);border:0;border-radius:var(--radius-pill);min-height:2.75rem;padding:0.55rem 1.15rem;font-size:0.72rem;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),inset 0 -1px 0 rgba(0,0,0,0.18),0 2px 8px rgba(2,5,10,0.28);transition:transform 180ms ease,box-shadow 180ms ease}
button:hover{transform:scale(1.04);box-shadow:inset 0 1px 0 rgba(255,255,255,0.45),inset 0 -1px 0 rgba(0,0,0,0.18),0 4px 14px rgba(2,5,10,0.34)}
button:active{transform:scale(0.97)}
button.ghost{background:linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.02));color:var(--ink-muted);border:1px solid var(--ring);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),0 1px 4px rgba(2,5,10,0.2)}
button.ghost:hover{color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
input[type=text],input[type=password],input[type=email],input[type=number],input[type=url],input[type=date],input[type=datetime-local],select,textarea{background:var(--well-bg);color:var(--ink);border:1px solid var(--ring);border-radius:var(--radius-well);min-height:2.75rem;padding:0.6rem 0.85rem;flex:1;font-size:1rem;font-family:var(--font-body);outline:none;min-width:0}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
input::placeholder,textarea::placeholder{color:var(--ink-muted)}
textarea{line-height:1.45;resize:vertical}
.item{display:flex;align-items:center;gap:0.65rem;border:1px solid var(--ring);border-radius:var(--radius-well);min-height:2.9rem;padding:0.7rem 0.85rem;margin-bottom:0.55rem;font-size:0.95rem;background:var(--well-bg)}
.item.pending{border-style:dashed}
.done{text-decoration:line-through;color:var(--ink-muted)}
.grow{flex:1}
.when{color:var(--ink-muted);font-size:0.82rem;white-space:nowrap;font-family:var(--font-ui)}
.chip{font-family:var(--font-ui);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted);border:1px solid var(--ring);border-radius:var(--radius-pill);padding:0.2rem 0.55rem;white-space:nowrap;background:linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))}
.chip.on{color:var(--on-accent);background:var(--accent);border-color:transparent}
details{border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.85rem;background:var(--well-bg);margin-bottom:0.6rem}
summary{font-family:var(--font-ui);font-size:0.7rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--ink-muted);cursor:pointer;min-height:1.8rem;display:flex;align-items:center}
pre{background:var(--well-bg);border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.6rem 0.75rem;font-family:var(--font-ui);font-size:0.68rem;line-height:1.45;white-space:pre-wrap;word-break:break-all;max-height:240px;overflow:auto;color:var(--accent)}
ul{margin:0.2rem 0 0.8rem;padding-left:1.1rem}
li{font-size:0.92rem;line-height:1.5;color:var(--ink-muted)}
li strong{color:var(--ink)}
table{width:100%;border-collapse:collapse;font-size:0.85rem}
th{font-family:var(--font-ui);font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted);text-align:left;padding:0.4rem 0.5rem;border-bottom:1px solid var(--ring)}
td{text-align:left;padding:0.5rem;border-bottom:1px solid var(--ring)}
form{margin:0}
form.inline{display:inline-flex}
form.stack{display:grid;gap:0.55rem;margin-top:0.5rem}
.row{display:flex;gap:0.55rem;flex-wrap:wrap;align-items:center}
.row.actions{margin-top:0.85rem}
.addrow{display:flex;gap:0.55rem;margin-top:0.8rem}
.cols{display:flex;gap:0.7rem;align-items:flex-start;width:min(100%,36rem);overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;padding-bottom:0.3rem}
.col{flex:1;min-width:min(78vw,16rem);scroll-snap-align:start;border:1px solid var(--ring);border-radius:var(--radius-panel);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow);padding:0.75rem}
.col h2{margin:0.2rem 0.2rem 0.7rem}
.card{background:var(--well-bg);border:1px solid var(--ring);border-radius:var(--radius-well);padding:0.7rem 0.8rem;margin-bottom:0.6rem;font-size:0.92rem;line-height:1.45}
.card form{margin-top:0.5rem;display:flex;gap:0.4rem;flex-wrap:wrap}
.card.pending{border-style:dashed;background:transparent}
.day{font-family:var(--font-ui);font-size:0.62rem;font-weight:500;margin:1rem 0.15rem 0.5rem;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.1em}
.tile{display:block;border:1px solid var(--ring);border-radius:var(--radius-panel);background:var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow);padding:1rem 1.05rem;text-decoration:none;color:var(--ink);transition:transform 180ms ease}
.tile:hover{transform:scale(1.02)}
.tile .name{font-size:1.15rem;letter-spacing:-0.02em}
.tile .desc{color:var(--ink-muted);font-size:0.82rem;margin-top:0.25rem;font-family:var(--font-ui);letter-spacing:0.02em}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr));gap:0.7rem;width:min(100%,36rem)}
.icongrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem 0.5rem;width:min(100%,36rem)}
.icongrid a{display:flex;flex-direction:column;align-items:center;gap:0.45rem;text-decoration:none;color:var(--ink);min-width:0}
.icongrid .label{font-family:var(--font-ui);font-size:0.66rem;letter-spacing:0.02em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.avatar{position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;width:2.75rem;height:2.75rem;border-radius:50%;border:1px solid var(--ring);background:linear-gradient(145deg,hsl(var(--tint,220) 42% 62%),hsl(var(--tint,220) 55% 38%));color:#fff;font-family:var(--font-ui);font-size:1rem;text-transform:uppercase;box-shadow:var(--shadow),inset 0 1px 1px rgba(255,255,255,0.4),inset 0 -2px 4px rgba(0,0,0,0.25);overflow:hidden}
.avatar::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(165deg,rgba(255,255,255,0.35) 0%,rgba(255,255,255,0.08) 38%,transparent 55%);pointer-events:none}
.avatar img{width:100%;height:100%;object-fit:cover}
.icongrid .avatar{width:clamp(3.4rem,17vw,4.1rem);height:clamp(3.4rem,17vw,4.1rem);font-size:1.3rem}
.explore{width:min(100%,36rem);font-family:var(--font-body);font-size:clamp(1.5rem,4.6vw,1.9rem);font-weight:600;letter-spacing:-0.03em;text-transform:none;color:var(--ink);margin:1.4rem 0 0.9rem;text-align:left}
.approw{display:flex;align-items:center;gap:0.8rem;width:min(100%,36rem);margin:0 0 0.6rem;text-decoration:none;color:var(--ink)}
.approw .name{display:block;font-size:1.15rem;font-weight:600;letter-spacing:-0.02em;line-height:1.25}
.approw .desc{display:block;color:var(--ink-muted);font-size:0.85rem;font-family:var(--font-ui);letter-spacing:0.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.approw .meta{min-width:0;flex:1}
.hero{display:flex;align-items:center;justify-content:center;width:min(100%,36rem);aspect-ratio:16/9;border-radius:1.3rem;border:1px solid var(--ring);margin:0 0 1.3rem;background:linear-gradient(160deg,hsl(var(--tint,220) 48% 66%),hsl(var(--tint,220) 60% 34%));box-shadow:var(--shadow);overflow:hidden;text-decoration:none}
.hero img{width:100%;height:100%;object-fit:cover}
.hero .avatar{width:4.5rem;height:4.5rem;font-size:1.9rem;border-color:rgba(255,255,255,0.4)}
footer.nav{display:flex;align-items:center;justify-content:space-between;gap:0.75rem;font-family:var(--font-ui)}
.navlink{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 1.1rem;border-radius:var(--radius-pill);border:1px solid var(--ring);background:linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0) 60%),var(--panel-bg);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:inset 0 1px 0 rgba(255,255,255,0.2),0 1px 4px rgba(2,5,10,0.2);font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink);text-decoration:none;white-space:nowrap;transition:transform 200ms ease}
.navlink:hover{transform:scale(1.04)}
.navlink:active{transform:scale(0.97)}
`;

/**
 * Lite additions for Messages-extension webviews: no backdrop-filter (the
 * big GPU cost), no fixed-attachment canvas, no entrance animation. The
 * shader element itself stays — themes already fall back to the canvas
 * gradient when WebGL is unavailable.
 */
const LITE_CSS = `
.logo-pill,.app-pill,.panel,.navlink,.col,.tile{backdrop-filter:none;-webkit-backdrop-filter:none}
html{background-attachment:scroll}
main.app{animation:none}
`;

/** Deterministic hue per app slug — drives avatar/hero gradients. */
export function tintHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

/** Circular app avatar: the icon image when one exists, otherwise the
 * app's initial over a slug-tinted gradient. */
export function avatarHtml(
  name: string,
  slug: string,
  iconUrl?: string | null
): string {
  const inner = iconUrl
    ? `<img src="${esc(iconUrl)}" alt="">`
    : esc((name || slug).slice(0, 1));
  return `<span class="avatar" style="--tint:${tintHue(slug)}" aria-hidden="true">${inner}</span>`;
}

export interface ShellOptions {
  /** Document + header title, e.g. "Todo". */
  title: string;
  /** Mono eyebrow above the headline, e.g. "Tasks". */
  kicker: string;
  /** Panel-and-row HTML emitted by the renderer. */
  body: string;
  /** Highlighted one-line notice above the content. */
  notice?: string | null;
  /** Card-opened session — render the lighter variant. */
  lite?: boolean;
  /** Skip the big display headline (dense tools like kanban). */
  headline?: boolean;
  /** Theme; defaults to the WZRD atmosphere look. */
  theme?: Theme;
}

export function renderShell(options: ShellOptions): string {
  const current = options.theme ?? activeTheme();
  const lite = options.lite ?? false;
  // Full-screen sessions swap the theme's backdrop for the user's chosen
  // effect (a lazy-loaded React Bits port). Card-opened lite sessions keep
  // the theme backdrop — the Messages webview can't afford a three.js scene.
  const background = lite ? "theme" : activeBackground();
  const fonts =
    current.fontStylesheet === null
      ? ""
      : `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(current.fontStylesheet)}">`;
  const backdrop = current.backdrop;
  const shader =
    background !== "theme"
      ? '<script type="module" src="/creator-os/bg/bg.js"></script>'
      : backdrop.kind === "shader"
        ? `<script src="${esc(backdrop.script)}" defer></script>`
        : "";
  const backdropHtml =
    background !== "theme"
      ? `<div id="wz-bg" class="backdrop" data-effect="${esc(background)}" aria-hidden="true"></div>`
      : backdrop.kind === "shader"
        ? (lite
            ? backdrop.element.replace('rays="0.9"', 'rays="0.4"')
            : backdrop.element
          ).replace("<wz-sky", '<wz-sky class="backdrop"')
        : "";
  const grain =
    backdrop.grain && !lite
      ? '<div class="grain" aria-hidden="true"></div>'
      : "";
  const scrim =
    current.tokens.scrim === "none"
      ? ""
      : '<div class="scrim" aria-hidden="true"></div>';
  const noticeHtml = options.notice
    ? `<div class="notice">${esc(options.notice)}</div>`
    : "";
  const headline =
    options.headline === false
      ? ""
      : `<p class="kicker">${esc(options.kicker)}</p><h1>${esc(options.title)}</h1>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>${esc(options.title)}</title>${fonts}<style>${tokenBlock(current.tokens)}${SHELL_CSS}${lite ? LITE_CSS : ""}</style>${shader}</head><body>${backdropHtml}${scrim}${grain}<div class="frame"><header class="bar"><span class="logo-pill"><img src="/creator-os/wzrd-wordmark-1600.png" alt="WZRD.tech"></span><span class="app-pill">${esc(options.kicker)}</span></header><main class="app">${noticeHtml}${headline}${options.body}</main></div></body></html>`;
}

/** Response wrapper: theme-derived CSP over the strict mini-app baseline. */
export function shellHtml(
  body: string,
  current: Theme = activeTheme()
): NextResponse {
  const headers = baseHeaders();
  // A chosen backdrop effect loads the self-hosted /creator-os/bg bundle
  // even on themes whose own backdrop needs no script (Pixel).
  const csp = themeCsp(current);
  const scriptSrc =
    activeBackground() !== "theme" && !csp.includes("script-src")
      ? "; script-src 'self'"
      : "";
  headers["Content-Security-Policy"] =
    `${csp}${scriptSrc}; form-action 'self'; frame-ancestors 'self' ${env.appOrigin()}`;
  return new NextResponse(body, {
    status: 200,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}
