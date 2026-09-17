<!-- Brief for arlan/shutter-type (goal-create-v12 §11.3). Source: arlan.me/vault (Arlan Marat), MIT, Tier A per kit.sources.json; supplied verbatim by the owner on 2026-09-17. Re-verify the vault license evidence at harvest. Harvest notes: `--font-neue-montreal` → var(--font-body); `../../lib/view-transition` → kit/arlan/holo/view-transition.ts; PAPER/SKY become props defaulting to --canvas/--accent; lite: true (Canvas 2D). -->

# Shutter Type (`arlan/shutter-type`)

## Build this

Build this: two lines of type seen through a rolling shutter, on a 600x338 scene you scale as one unit: sky blue #00afca type on warm paper #f6f3ea, inverting to paper type on a sky ground on set frames. A 2.72s loop of 68 frames at 40ms, one hard cut at frame 29. THE WHOLE EFFECT IS ONE POST-PROCESS, and it is the only thing you need to get right: cut the frame into horizontal stripes 14-60px tall with a fixed seeded map (a dozen or so stripes, never two neighbours with the same lag), give each stripe a time lag between 0 and 2.4 frames, and have each stripe show the scene as it was that long ago. Quantise the lags to five taps, render the clean scene five times a frame into five offscreen canvases (once per tap), then copy each stripe from its own tap. At rest the taps agree and the type is whole; the moment a word moves, stripes with the biggest lag are left behind and the word tears into bands and prints double above or below itself. Do NOT paint slices onto the letters or randomise offsets per frame: the tearing must be a function of MOTION, so it disappears by itself when the type stops and grows with speed. Clamp every stripe's sample time at the current phrase's first frame so no stripe ever shows the previous phrase after the cut. Draw the ground once, from the present, before the stripes: only the ink is late, and an inversion arrives whole and instant, as a slap. PHRASE ONE, frames 0-28: 'Design is thinking' in a medium geometric grotesque, cap 49px, baseline 187, word ink-box centres at x 139, 284 and 443 (boxes 30..248, 260..308, 317..569: the face's own proportions across a 539px span, word spaces of 12 and 9). Each word arrives by JITTER, not ease: for seven frames it sits at a fresh random height within about 15px of home, flipping sign almost every frame, then takes one larger kick (34px, 27px, 28px for the three words, in opposite directions) and decays home by a factor of 0.62 a frame, landing on frame 13. Read the jitter as steps, never interpolate it. The shutter turns those jumps into the torn, double-printed opening. From frame 10 the ground is sky blue. Once settled the line pushes in 0.26% a frame about its centre (300, 163), growing from 535 to 560px wide over the phrase, and from frame 22 lifts on a 10-frame cubic-bezier(0.85, 0, 0.15, 1) that would carry it 97px up; the cut lands on frame 29 with the line still rising. APPLY THE SHUTTER TO THE JITTER ONLY: shutter the words at rest scale into an intermediate layer, then push in and lift THAT layer as one piece, so the line leaves whole; a shutter on the lift tears a line that is meant to leave clean. PHRASE TWO, frames 29-67: 'made visual' stacked on a 126px row pitch, x-height 57px, the middle row's baseline at 129 at rest, 'made' centred at x 155.5 and 'visual' at 441.5 (boxes 30..281 and 314..569, a 33px word space, the same 539px span as phrase one). The stack scrolls UP exactly one pitch per beat, a beat every 14 frames, each beat a 12-frame cubic-bezier(0.8, 0, 0.2, 1); the first beat began on frame 27, two frames before the phrase, so it is cut in mid-move. A full pitch is invisible at rest because the stack is periodic, so the only thing the eye ever sees is the tearing mid-scroll, and the peak speed of about 45px a frame against a 2.4-frame lag is a tear of most of a row. 'visual' runs 0.4 of a frame behind 'made', which is what splits the two words on the fast frames. Ground: paper from the cut on 29 through 53, sky from 54 to the end; every swap lands on a beat (the settle, the cut, the fourth scroll, the loop), never mid-scroll, where a flash reads as a glitch. DRAW WITH fillText, place each word by its measured ink-box centre and squeeze it horizontally to its own set width (Design 218, is 48, thinking 252; made 251, visual 255 px) so the word spaces stay the set ones in any face (draw each word once offscreen at boot and read the box back; re-measure when the webfont arrives so the composition holds still), size the small line by cap height and the stack by x-height, cap the device ratio at 2, run a continuous clock so the eases are smooth at 60Hz while the jitter table stays stepped, pause offscreen / hidden / during route transitions, and show the stack at rest on paper under reduced motion.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

## shutter-type/params.ts

```ts
export const FRAME_MS = 40;
export const FRAMES = 68;
export const LOOP_MS = FRAMES * FRAME_MS;

export const SCENE_W = 600;
export const SCENE_H = 337.5;

export const PAPER = "#f6f3ea";
export const SKY = "#00afca";

export const FONT_VAR = "--font-neue-montreal";
export const FONT_WEIGHT = 500;

export type Bezier = readonly [number, number, number, number];
export const EASE_SCROLL: Bezier = [0.8, 0, 0.2, 1];
export const EASE_LIFT: Bezier = [0.85, 0, 0.15, 1];

export function bezier(t: number, [x1, y1, x2, y2]: Bezier): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const u = (lo + hi) / 2;
    const v = 1 - u;
    const x = 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u;
    if (x < t) lo = u;
    else hi = u;
  }
  const u = (lo + hi) / 2;
  const v = 1 - u;
  return 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u;
}

export function step(table: readonly number[], i: number): number {
  const k = Math.max(0, Math.min(table.length - 1, Math.floor(i)));
  return table[k];
}

export type PhaseName = "streams" | "addup";

export interface Phase {
  name: PhaseName;

  from: number;
  to: number;
}

export const PHASES: readonly Phase[] = [
  { name: "streams", from: 0, to: 28 },
  { name: "addup", from: 29, to: 67 },
];

export function phaseAt(frame: number): Phase {
  const f = ((Math.floor(frame) % FRAMES) + FRAMES) % FRAMES;
  return f <= PHASES[0].to ? PHASES[0] : PHASES[1];
}

export const SKY_SPANS: readonly (readonly [number, number])[] = [
  [10, 28],
  [54, 67],
];

export function isSky(frame: number): boolean {
  const f = ((Math.floor(frame) % FRAMES) + FRAMES) % FRAMES;
  return SKY_SPANS.some(([a, b]) => f >= a && f <= b);
}

export const STREAMS_CAP = 49;

export const STREAMS_BASELINE = 187;
export const STREAMS_CENTRE = { x: 300, y: 163 } as const;

export interface StreamsWord {
  text: string;

  x: number;

  w: number;

  dy: readonly number[];
}

export const STREAMS_WORDS: readonly StreamsWord[] = [
  { text: "Design", x: 139, w: 218, dy: [-11, -12, -13, 8, 14, -14, 34, 22, 14, 8, 4, 2, 2, 0] },
  { text: "is", x: 284, w: 48, dy: [12, 8, -13, -11, 14, -10, 16, -27, -17, -10, -5, -2, -2, 0] },
  { text: "thinking", x: 443, w: 252, dy: [-8, -15, -15, 13, -14, 11, -16, 28, 18, 10, 5, 2, 2, 0] },
];

export const STREAMS_ZOOM_PER_FRAME = 0.0026;
export const STREAMS_ZOOM_ZERO = 13;

export const STREAMS_LIFT_START = 22;
export const STREAMS_LIFT_FRAMES = 10;
export const STREAMS_LIFT_PX = 97;

export function streamsScale(f: number): number {
  return 1 + STREAMS_ZOOM_PER_FRAME * (Math.max(f, 10) - STREAMS_ZOOM_ZERO);
}

export function streamsLift(f: number): number {
  return STREAMS_LIFT_PX * bezier((f - STREAMS_LIFT_START) / STREAMS_LIFT_FRAMES, EASE_LIFT);
}

export function streamsInner(f: number): { x: number; baseline: number }[] {
  return STREAMS_WORDS.map((w) => ({ x: w.x, baseline: STREAMS_BASELINE + step(w.dy, f) }));
}

export function streamsOuter(f: number): { scale: number; lift: number } {
  return { scale: streamsScale(f), lift: streamsLift(f) };
}

export function streamsPose(f: number): { words: { x: number; baseline: number }[]; scale: number } {
  const s = streamsScale(f);
  const lift = streamsLift(f);
  const cy = STREAMS_CENTRE.y - lift;
  const baseline = cy + (STREAMS_BASELINE - STREAMS_CENTRE.y) * s;
  return {
    scale: s,
    words: STREAMS_WORDS.map((w) => ({
      x: STREAMS_CENTRE.x + (w.x - STREAMS_CENTRE.x) * s,
      baseline: baseline + step(w.dy, f) * s,
    })),
  };
}

export const ADDUP_XHEIGHT = 57;

export const ADDUP_PITCH = 126;

export const ADDUP_BASELINE = 129;

export interface AddupWord {
  text: string;

  x: number;
  w: number;

  lag: number;
}

export const ADDUP_WORDS: readonly AddupWord[] = [
  { text: "made", x: 155.5, w: 251, lag: 0 },
  { text: "visual", x: 441.5, w: 255, lag: 0.4 },
];

export const ADDUP_BEAT = 14;
export const ADDUP_SCROLL_FRAMES = 12;
export const ADDUP_FIRST_SCROLL = 27;

export function addupScroll(f: number): number {
  const since = f - ADDUP_FIRST_SCROLL;
  const beats = Math.floor(since / ADDUP_BEAT);
  const within = since - beats * ADDUP_BEAT;
  return ADDUP_PITCH * (beats + bezier(within / ADDUP_SCROLL_FRAMES, EASE_SCROLL));
}

export function addupBaselines(f: number): number[] {
  return ADDUP_WORDS.map((w) => {
    const up = addupScroll(f - w.lag) % ADDUP_PITCH;
    return ADDUP_BASELINE - up;
  });
}

export const STRIPE_MIN = 14;
export const STRIPE_MAX = 60;

export const STRIPE_LAG_MAX = 2.4;

export const STRIPE_TAPS = 5;

export const STRIPE_SEED = 0x51ab7e;

export interface Stripe {
  y0: number;
  y1: number;

  lag: number;

  tap: number;
}

export function stripeLagOfTap(tap: number): number {
  return (STRIPE_LAG_MAX * tap) / (STRIPE_TAPS - 1);
}

export function buildStripes(seed = STRIPE_SEED): Stripe[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const out: Stripe[] = [];
  let y = 0;
  let lastTap = -1;
  while (y < SCENE_H) {
    const h = STRIPE_MIN + rnd() * (STRIPE_MAX - STRIPE_MIN);

    let tap = Math.floor(rnd() * STRIPE_TAPS);
    if (tap === lastTap) tap = (tap + 1 + Math.floor(rnd() * (STRIPE_TAPS - 1))) % STRIPE_TAPS;
    lastTap = tap;
    out.push({ y0: y, y1: Math.min(SCENE_H, y + h), lag: stripeLagOfTap(tap), tap });
    y += h;
  }
  return out;
}

export function sampleFrame(f: number, lag: number): number {
  const phase = phaseAt(f);
  return Math.max(phase.from, f - lag);
}

export const STILL_FRAME = 40;
```

## shutter-type/engine.ts

```ts
import {
  ADDUP_WORDS,
  ADDUP_XHEIGHT,
  ADDUP_PITCH,
  FONT_WEIGHT,
  FRAME_MS,
  LOOP_MS,
  PAPER,
  SKY,
  SCENE_H,
  SCENE_W,
  STILL_FRAME,
  STREAMS_CAP,
  STREAMS_CENTRE,
  STREAMS_WORDS,
  STRIPE_TAPS,
  type Stripe,
  addupBaselines,
  buildStripes,
  isSky,
  phaseAt,
  sampleFrame,
  streamsInner,
  streamsOuter,
  stripeLagOfTap,
} from "./params";

interface Box {

  cx: number;

  w: number;
}

const MEASURE_PX = 200;

export class ShutterType {
  private ctx: CanvasRenderingContext2D | null;

  private taps: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }[] = [];
  private inner: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private stripes: Stripe[] = buildStripes();
  private raf = 0;
  private running = false;
  private elapsed = 0;
  private t0 = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;

  private capPerPx = 0.7;
  private xPerPx = 0.5;
  private boxes = new Map<string, Box>();

  readonly ok: boolean;

  constructor(
    private canvas: HTMLCanvasElement,
    private family: string = "sans-serif",
  ) {
    this.ctx = canvas.getContext("2d");
    this.ok = !!this.ctx;
    if (this.ok) {
      this.measure();
      this.resize();
    }
  }

  private font(px: number): string {
    return `${FONT_WEIGHT} ${px}px ${this.family}`;
  }

  refreshFont(family?: string) {
    if (family) this.family = family;
    this.measure();
    if (!this.running) this.renderStill();
  }

  resize() {
    const c = this.canvas;
    const box = c.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    this.taps = [];
    for (let i = 0; i <= STRIPE_TAPS; i++) {
      const t = document.createElement("canvas");
      t.width = c.width;
      t.height = c.height;
      const tctx = t.getContext("2d");
      if (!tctx) continue;
      if (i < STRIPE_TAPS) this.taps.push({ canvas: t, ctx: tctx });
      else this.inner = { canvas: t, ctx: tctx };
    }
    if (!this.running) this.renderStill();
  }

  private measure() {
    const words = new Set<string>(["E", "x"]);
    for (const w of STREAMS_WORDS) words.add(w.text);
    for (const w of ADDUP_WORDS) words.add(w.text);
    const S = MEASURE_PX * 6;
    const off = document.createElement("canvas");
    off.width = S;
    off.height = MEASURE_PX * 3;
    const g = off.getContext("2d", { willReadFrequently: true });
    if (!g) return;
    const ox = MEASURE_PX / 2;
    const oy = MEASURE_PX * 2;
    g.font = this.font(MEASURE_PX);
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.fillStyle = "#fff";
    for (const word of words) {
      g.clearRect(0, 0, off.width, off.height);
      g.fillText(word, ox, oy);
      const px = g.getImageData(0, 0, off.width, off.height).data;
      let x0 = off.width;
      let x1 = -1;
      let y0 = off.height;
      let y1 = -1;
      for (let y = 0; y < off.height; y++) {
        for (let x = 0; x < off.width; x++) {
          if (px[(y * off.width + x) * 4 + 3] < 128) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) continue;
      this.boxes.set(word, { cx: ((x0 + x1 + 1) / 2 - ox) / MEASURE_PX, w: (x1 - x0 + 1) / MEASURE_PX });
      if (word === "E") this.capPerPx = (y1 - y0 + 1) / MEASURE_PX;
      if (word === "x") this.xPerPx = (y1 - y0 + 1) / MEASURE_PX;
    }
  }

  private squeeze(text: string, w: number, px: number): number {
    const b = this.boxes.get(text);
    return b && b.w > 0 ? w / (b.w * px) : 1;
  }

  private word(
    ctx: CanvasRenderingContext2D,
    text: string,
    px: number,
    x: number,
    baseline: number,
    kx: number,
  ) {
    const b = this.boxes.get(text);
    if (!b) return;
    ctx.save();
    ctx.translate(x, baseline);
    ctx.scale(kx, 1);
    ctx.fillText(text, -b.cx * px, 0);
    ctx.restore();
  }

  private scene(ctx: CanvasRenderingContext2D, f: number, ink: string) {
    const k = this.canvas.width / SCENE_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = ink;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const phase = phaseAt(f);
    if (phase.name === "streams") {

      const px = STREAMS_CAP / this.capPerPx;
      ctx.font = this.font(px);
      const pose = streamsInner(f);
      STREAMS_WORDS.forEach((w, i) =>
        this.word(ctx, w.text, px, pose[i].x, pose[i].baseline, this.squeeze(w.text, w.w, px)),
      );
    } else {
      const px = ADDUP_XHEIGHT / this.xPerPx;
      ctx.font = this.font(px);
      const base = addupBaselines(f);
      ADDUP_WORDS.forEach((w, i) => {
        const kx = this.squeeze(w.text, w.w, px);

        for (let r = -2; r <= 3; r++) {
          this.word(ctx, w.text, px, w.x, base[i] + r * ADDUP_PITCH, kx);
        }
      });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  render(f: number) {
    const ctx = this.ctx;
    const inner = this.inner;
    if (!ctx || !inner || this.taps.length < STRIPE_TAPS) return;
    const phase = phaseAt(f);
    const sky = isSky(f);
    const ground = sky ? SKY : PAPER;
    const ink = sky ? PAPER : SKY;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < STRIPE_TAPS; i++) {
      this.scene(this.taps[i].ctx, sampleFrame(f, stripeLagOfTap(i)), ink);
    }

    const k = W / SCENE_W;
    inner.ctx.setTransform(1, 0, 0, 1, 0, 0);
    inner.ctx.clearRect(0, 0, W, H);
    for (const s of this.stripes) {
      const y0 = Math.round(s.y0 * k);
      const y1 = Math.min(H, Math.round(s.y1 * k));
      if (y1 <= y0) continue;
      inner.ctx.drawImage(this.taps[s.tap].canvas, 0, y0, W, y1 - y0, 0, y0, W, y1 - y0);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (phase.name === "streams") {
      const { scale, lift } = streamsOuter(f);
      const cx = STREAMS_CENTRE.x * k;
      const cy = STREAMS_CENTRE.y * k;
      ctx.translate(cx, cy - lift * k);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(inner.canvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  start() {
    if (this.running || !this.ok) return;
    this.running = true;
    this.t0 = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const t = (this.elapsed + (now - this.t0)) % LOOP_MS;
      this.render(t / FRAME_MS);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.running) {
      this.elapsed = (this.elapsed + (performance.now() - this.t0)) % LOOP_MS;
    }
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  renderStill() {
    this.render(STILL_FRAME);
  }

  destroy() {
    this.stop();
    this.taps = [];
    this.inner = null;
    this.boxes.clear();
    this.ctx = null;
  }
}

export const SCENE_ASPECT = SCENE_W / SCENE_H;
```

## shutter-type/ShutterTypeCard.tsx

```tsx
"use client";

import { useEffect, useRef } from "react";
import { ShutterType } from "./engine";
import { FONT_VAR, FONT_WEIGHT, PAPER } from "./params";
import { onTransitionChange } from "../../lib/view-transition";

export function ShutterTypeCard({
  bare = false,
  viewTransitionName,
}: {
  bare?: boolean;
  viewTransitionName?: string;
} = {}) {
  void bare;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: ShutterType | null = null;
    let onScreen = false;
    let hidden = false;
    let inTransition = false;

    const sync = () => {
      if (!engine || reduced) return;
      if (onScreen && !hidden && !inTransition) engine.start();
      else engine.stop();
    };

    const raf = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;font-family:var(${FONT_VAR})`;
      probe.textContent = "Ag";
      document.body.appendChild(probe);
      const fam = getComputedStyle(probe).fontFamily || "sans-serif";
      document.body.removeChild(probe);

      engine = new ShutterType(canvas, fam);
      if (!engine.ok) return;
      if (reduced) engine.renderStill();
      else sync();

      if (document.fonts?.load) {
        const first = fam.split(",")[0].replace(/["']/g, "").trim();
        document.fonts
          .load(`${FONT_WEIGHT} 1em "${first}"`)
          .then(() => engine?.refreshFont(), () => {});
      }
    });

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.2 },
    );
    io.observe(canvas);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => engine?.resize(), 120);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(rt);
      engine?.destroy();
      engine = null;
    };
  }, []);

  return (
    <div
      data-canvas-card
      role="img"
      aria-label="Sky blue type on warm paper, seen through a rolling shutter. The words 'Design is thinking' shake into place, each word cut into horizontal bands that lag behind it, then the colours invert to paper type on sky blue, the line swells slightly and lifts off the top. A tall stack of 'made visual' takes its place, scrolling up one row at a time; with each scroll the letters tear into sliding bands and knit back together, and the ground swaps back to sky blue for the last beats."
      style={{
        ...(viewTransitionName ? { viewTransitionName } : null),
        backgroundColor: PAPER,
      }}
      className="relative mx-auto aspect-video w-full select-none overflow-hidden rounded-[12px] border border-[var(--border-line)]"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
```
