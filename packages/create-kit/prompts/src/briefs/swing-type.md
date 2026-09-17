<!-- Brief for arlan/swing-type (goal-create-v12 §11.3). Source: arlan.me/vault (Arlan Marat), MIT, Tier A per kit.sources.json; supplied verbatim by the owner on 2026-09-17. Re-verify the vault license evidence at harvest. Harvest notes: `--font-neue-montreal` → var(--font-body); `../../lib/view-transition` → kit/arlan/holo/view-transition.ts; INK palette → five token-derived hues at equal chroma/lightness on the theme canvas; WORDS becomes a prop (all words the same length, enforced); the card wrapper's `backgroundColor: "#000"` is upstream's and should follow BG; lite: true (Canvas 2D). -->

# Swing Type (`arlan/swing-type`)

## Build this

Build this: a row of ENORMOUS coloured letters on a white field that swings back and forth past a fixed window, each letter turning on its own vertical axis as it travels so it squashes to a thin coloured sliver at the sides and opens to full face in the middle. Only two or three letters are readable at any moment and the whole word NEVER assembles, which is the entire point of the piece. Every few seconds the word becomes a different one, and the letters change by turning: each one rotates to edge-on, swaps there where it is a hairline, and turns back as its new letter. THE WHOLE EFFECT IS ONE LINE OF GEOMETRY: a letter's rotation is its distance from the frame centre divided by a constant (angle = (x - centre) / K), so the row merely TRANSLATES and every other quantity falls out of that one relation. Horizontal squash is cos(angle), the letter culls at 90 degrees, and the gap between letters in pixels is K times the gap in radians. No second clock, no per-letter state. DO NOT BUILD THIS AS A CYLINDER. A cylinder puts screen x on a SINE of the angle; this puts x LINEARLY on the angle, which is a different picture (a cylinder bunches its letters toward the silhouette edges and this does not) and leaves 30px of error where the linear law is flat to a few. THE MOTION IS A PENDULUM, NOT A SPIN: phase = A*sin(2*pi*t/T), about a 2 second loop, exactly palindromic. DERIVE THE AMPLITUDE FROM THE LETTER COUNT rather than declaring it: it should be exactly half the word's angular width, which lands an END LETTER DEAD CENTRE at each extreme. Hardcode a number instead and a shorter word swings clean out of the window, stranding a single squashed letter alone in the frame for a third of the loop. GIVE THE SWING A DETENT SO IT CLICKS FROM LETTER TO LETTER. A pure sine is fastest at phase zero and stops at the extremes, so it lingers on the two END letters (they are the ones dead centre at an extreme) and whips past every letter in between: the middle of the word gets the least time square-on, which is backwards. Warp the phase to crawl wherever a letter is square-on, which is every multiple of the pitch: phi = base - DETENT * (PITCH/2pi) * sin(2pi * base / PITCH). Two properties make this right rather than a hack. It is derived from the pitch, so it stays correct if the pitch moves. And the correction is EXACTLY ZERO at every multiple of half the pitch, which includes both extremes whatever the letter count, so the swing still lands precisely on the derived amplitude with an end letter dead centre. Keep DETENT below 1: the phase derivative is 1 - DETENT*cos(...), so at 1 the row stalls at each detent and past it the motion reverses into a stutter. PITCH THE LETTERS WIDE, around 78 degrees apart. That single number is why you only ever see two or three of them (a 180-degree visible window holds 180/78 = 2.3) and it is also what stops them colliding even though a full-face round letter is WIDER than the pitch in pixels: by the time one letter opens up, its neighbours are squashed to cos(78) = 0.21 and there is nothing left to overlap. That argument is about ANGLES, not pixels, so it holds at any type size. A tighter pitch fills more of the frame and destroys the piece, because it becomes a readable marquee. CHANGE THE WORD BY TURNING THE LETTER, AND DO NOT WASTE A DAY TRYING TO HIDE IT. The obvious plan is to swap a slot while it is culled, since a letter past edge-on is not drawn. IT DOES NOT WORK AT THIS PITCH, and the reason is one sentence: the slots either side of centre sit a pitch apart while the cull is 90 degrees, so THEY ARE NEVER BOTH HIDDEN AT THE SAME TIME. Whichever takes the new word first stands beside one that has not, and the row spells neither word. Verify this before believing any scheme that claims otherwise: search all orderings of the slots across every cue phase, every split of the row into two groups with every pair of swap instants, and a sweep of the squash threshold. All of them come back empty, and a hidden turnover only becomes possible near 180 degrees of pitch, where a single letter is on screen and the piece is gone. So drive the changing letter TO EDGE-ON and back, and swap its glyph at the midpoint. The glyph still only ever changes unseen; what changed is that the rotation carrying it there is deliberate rather than borrowed from the swing. Turning is the piece's whole vocabulary, so it reads as language and not as a glitch. THE TRAP HERE IS SUBTLE AND WILL LOOK ALMOST RIGHT: do not add a fixed half turn to the slot's angle. The swing has already put the letter at an arbitrary angle, so base plus 90 is only edge-on if base happened to be zero, and glyphs end up changing at nearly full face. Instead take the ABSOLUTE angle from wherever it is up to the cull and back, as a triangle over the flip, so the midpoint is edge-on by construction. Ease the triangle in and out so the turn starts and lands softly, keep the flip well under the time between a slot's square-on moments (about 400ms against a second), and stagger neighbouring letters by around 90ms so the row rewrites itself left to right: together it reads as a cut, in sequence it reads as the word rewriting itself. Keep every word the SAME LENGTH, because the amplitude is derived from the letter count and changing it mid-loop makes the whole row lurch. Give the colour to the SLOT, not to the letter, so the row keeps its palette left to right across a turnover and a change reads as a change of letters rather than of scheme. DRAW FAR TO NEAR. Sort the letters by absolute angle before drawing, largest first, so the edge-on slivers land before the square-on letter and never paint over it. Without this the row draws in index order and a sliver at 80 degrees can cover the letter you are trying to read, which is wrong in a way you notice before you can name it. DRAW EACH LETTER AS ONE AFFINE, NOT A PERSPECTIVE SLICE LOOP. The letters are PARALLELOGRAMS (per-row width constant down a bar's whole height), not perspective trapezoids, so the correct construction is one cached glyph bitmap per letter and a single setTransform plus drawImage per visible letter per frame. That means no WebGL, no context to lose on a page full of canvases, and 60fps on a phone. LEAN THE LETTERS AS AN IN-PLANE ROTATION, NOT A SHEAR. Stems tilt as a letter turns and the tilt reverses across the centre; the width axis and the height axis tilt in OPPOSITE senses, which is a rotation. A symmetric shear tilts both the same way, is the obvious first guess, and is wrong. Without this the effect reads as flat 2D squashing rather than as something turning in space. KEEP THE LEAN AND THE VERTICAL LOSS AS SMALL SAMPLED TABLES rather than analytic curves: the lean PEAKS near 55-60 degrees and falls back toward the edges, which no monotonic vanishing-point model produces, and the vertical shrink bottoms out around 0.85 where a plain cosine would have driven it to 0.21. Then SCALE THE VERTICAL LOSS BY EACH GLYPH'S OWN HEIGHT: one table for every letter is a simplification, and taller letters lose more (0.78 against 0.86 at the same angle). The whole correction is under 8 percent, which is the size of thing you feel without being able to point at it, and it is what stops the row moving like one rigid object with letters painted on it. Scale each letter about a point ABOVE its baseline (roughly a third of a cap height up), not about the baseline and not about the glyph's own centre: the letters visibly lift off the baseline as they turn. GIVE THE LETTERS OPTICAL SIZE. The squash takes the stem down with it, so a letter that starts as a bold ends as a hairline exactly where it is moving fastest, and the row loses colour weight at the worst moment. Rasterise each letter at TWO weights and cross-fade the heavier one in as it turns edge-on. Two details matter: give the heavy cut a wider bleed box, because a bolder stem overflows the regular cut's ink box and a clipped edge is exactly what the fade exposes; and take the metrics from the REGULAR cut for both, so the two are registered and only the extra edge arrives rather than a ghosted double image. Be honest about the limit: holding the apparent stem constant would need roughly five times the weight, which no face has, so this slows the thinning rather than cancelling it. SOLVE THE TYPE SIZE FROM A MEASURED CAP HEIGHT, do not declare it: rasterise a capital and read its actual bounding box, so the composition does not jump when a late webfont swaps in over the fallback. Set it in a heavy grotesque (stem-to-cap around 0.16, so a real bold, not a regular). Note that the cap fraction is the ONLY lever on the band's width, because the band is K*pi wide and K is a multiple of the cap: smaller type and a narrower band are the same move, so shrinking the type also pulls the letters closer together in pixels. PICK THE PALETTE FOR THE FIELD IT IS ON. Five flat colours, no gradients, no shading, no outline anywhere. On white they should walk the hue circle at roughly EQUAL CHROMA AND LIGHTNESS, which is what makes a set read as a family: the eye forgives colours that differ in hue alone and reads a clash the moment one of them is also paler or duller than the rest. A palette built for a dark field will not survive the move, because its electric cyan turns to vapour and its dark green goes nearly as dark as body text. Framework-free Canvas 2D plus a rAF loop; pauses offscreen and when the tab is hidden; NO pointer interaction, because the piece is a loop you watch and not a thing you steer. Reduced motion draws ONE still with the word's initial at full face, not the loop's own resting phase, which happens to centre a bare vertical stem and says nothing about what the card is.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

## swing-type/params.ts

```ts
export const PERIOD = 2.0;

export const PITCH_DEG = 78;

export const swingDeg = (letters: number) => ((letters - 1) / 2) * PITCH_DEG;

export const CAP_FRAC = 0.46;

export const K_OVER_CAP = 115 / 263;

export const DETENT = 0.7;

export const CULL_DEG = 90;

export const VSCALE = [1.0, 0.995, 0.985, 0.955, 0.923, 0.86, 0.83];

export const VSCALE_BY_HEIGHT = 0.5;

export const LEAN = [0.0, 0.06, 0.115, 0.14, 0.15, 0.12, 0.06];

export const PIVOT_CAP = 0.37;

export const WORDS = ["Arlan", "Swing", "Turns", "Angle"];

export const WORD = WORDS[0];

export const WORD_SECONDS = 3;

export const FLIP_SECONDS = 0.42;

export const FLIP_STAGGER = 0.09;

export const INK = ["#F0413B", "#E88500", "#0FA3A3", "#2F6BE0", "#7A3BD6"];

export const BG = "#FFFFFF";

export const FONT_VAR = "--font-neue-montreal";
export const FONT_WEIGHT = 600;

export const FONT_WEIGHT_EDGE = 800;
```

## swing-type/engine.ts

```ts
import {
  BG,
  CAP_FRAC,
  CULL_DEG,
  DETENT,
  FONT_WEIGHT,
  FONT_WEIGHT_EDGE,
  INK,
  K_OVER_CAP,
  LEAN,
  PERIOD,
  PITCH_DEG,
  PIVOT_CAP,
  swingDeg,
  VSCALE,
  VSCALE_BY_HEIGHT,
  WORDS,
  WORD_SECONDS,
  FLIP_SECONDS,
  FLIP_STAGGER,
} from "./params";

const DEG = Math.PI / 180;

interface Face {

  bmp: HTMLCanvasElement;
  heavy: HTMLCanvasElement;

  w: number;
  h: number;

  dx: number;

  dy: number;

  tall: number;
}

interface Slot {

  u: number;

  faces: Face[];

  word: number;
}

const PITCH_RAD = PITCH_DEG * DEG;
function detent(phi: number): number {
  return phi - (DETENT * PITCH_RAD * Math.sin((2 * Math.PI * phi) / PITCH_RAD)) / (2 * Math.PI);
}

function table(t: number[], absDeg: number): number {
  const s = Math.min(absDeg, 90) / 15;
  const i = Math.min(Math.floor(s), t.length - 2);
  return t[i] + (t[i + 1] - t[i]) * (s - i);
}

export class SwingType {
  private ctx: CanvasRenderingContext2D | null;
  private raf = 0;
  private t0 = 0;
  private running = false;
  private dpr = 1;
  private w = 0;
  private h = 0;

  private slots: Slot[] = [];

  private target = 0;

  private flipAt: number[] = [];

  private clock = 0;
  private cap = 0;
  private K = 0;
  private baseline = 0;
  private pivotY = 0;

  readonly ok: boolean;

  constructor(
    private canvas: HTMLCanvasElement,
    private family: string = "sans-serif",
  ) {
    this.ctx = canvas.getContext("2d");
    this.ok = !!this.ctx;
    if (this.ok) this.resize();
  }

  refreshFont(family?: string) {
    if (family) this.family = family;
    this.layout();
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
    this.layout();
    if (!this.running) this.renderStill();
  }

  private layout() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.cap = this.h * CAP_FRAC;
    this.K = this.cap * K_OVER_CAP;

    this.baseline = this.h / 2 + this.cap / 2;
    this.pivotY = this.baseline - this.cap * PIVOT_CAP;

    const probe = 200;
    ctx.font = `${FONT_WEIGHT} ${probe}px ${this.family}`;
    const capAt = ctx.measureText("H").actualBoundingBoxAscent || probe * 0.72;
    const size = (probe * this.cap) / capAt;

    const words = WORDS.map((w: string) => [...w]);
    const n = words[0].length;
    const dpr = this.dpr;

    const faceOf = (ch: string, i: number, size: number): Face => {

      ctx.font = `${FONT_WEIGHT} ${size}px ${this.family}`;
      const m = ctx.measureText(ch);
      const left = m.actualBoundingBoxLeft;
      const right = m.actualBoundingBoxRight;
      const asc = m.actualBoundingBoxAscent;
      const desc = m.actualBoundingBoxDescent;
      const gw = Math.max(1, left + right);
      const gh = Math.max(1, asc + desc);
      const pad = 2;

      const cut = (weight: number) => {
        const c = document.createElement("canvas");

        const bleed = pad * 3;
        c.width = Math.ceil((gw + bleed * 2) * dpr);
        c.height = Math.ceil((gh + bleed * 2) * dpr);
        const g = c.getContext("2d");
        if (g) {
          g.scale(dpr, dpr);
          g.font = `${weight} ${size}px ${this.family}`;
          g.textBaseline = "alphabetic";

          g.fillStyle = INK[i % INK.length];
          g.fillText(ch, bleed + left, bleed + asc);
        }
        return c;
      };

      const bmp = cut(FONT_WEIGHT);
      const heavy = cut(FONT_WEIGHT_EDGE);
      const bleed = pad * 3;
      return {
        bmp,
        heavy,
        tall: gh / this.cap,
        w: gw + bleed * 2,
        h: gh + bleed * 2,
        dx: -(gw + bleed * 2) / 2,

        dy: this.cap * PIVOT_CAP - asc - bleed,
      };
    };

    const keep = this.slots.map((sl) => sl.word);
    this.slots = Array.from({ length: n }, (_, i) => ({

      u: (i - (n - 1) / 2) * PITCH_DEG * DEG,
      faces: words.map((w: string[]) => faceOf(w[i], i, size)),

      word: keep[i] ?? 0,
    }));
    if (this.flipAt.length !== n) this.flipAt = new Array(n).fill(-1);
  }

  private render(phi: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { dpr, w, h } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w * dpr, h * dpr);

    const cx = w / 2;

    const cullRad = CULL_DEG * DEG;
    const order = this.slots
      .map((sl, i) => {

        const base = sl.u + phi;
        let a = base;
        const from = this.flipAt[i];
        if (from >= 0) {
          const k = (this.clock - from) / FLIP_SECONDS;
          if (k >= 1) {
            this.flipAt[i] = -1;
            sl.word = this.target;
          } else if (k > 0) {

            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            const tri = 1 - Math.abs(2 * e - 1);
            const sign = base >= 0 ? 1 : -1;
            a = base + sign * (cullRad - Math.abs(base)) * tri;
            if (k >= 0.5) sl.word = this.target;
          }
        }
        return { sl, a };
      })
      .sort((p, q) => Math.abs(q.a) - Math.abs(p.a));

    const cull = CULL_DEG * DEG;
    for (const { sl, a } of order) {
      if (Math.abs(a) >= cull) continue;
      const g = sl.faces[sl.word];
      const x = cx + this.K * a;
      const absDeg = Math.abs(a) / DEG;
      const sq = Math.cos(a);

      const vs = 1 - (1 - table(VSCALE, absDeg)) * (1 + (g.tall - 1) * VSCALE_BY_HEIGHT);

      const rho = -Math.atan(table(LEAN, absDeg) * (a < 0 ? 1 : -1));
      const cr = Math.cos(rho);
      const sr = Math.sin(rho);

      ctx.setTransform(
        sq * cr * dpr,
        sq * sr * dpr,
        -vs * sr * dpr,
        vs * cr * dpr,
        x * dpr,
        this.pivotY * dpr,
      );

      ctx.drawImage(g.bmp, g.dx, g.dy, g.w, g.h);
      const heavy = 1 - sq;
      if (heavy > 0.01) {
        ctx.globalAlpha = heavy;
        ctx.drawImage(g.heavy, g.dx, g.dy, g.w, g.h);
        ctx.globalAlpha = 1;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  start() {
    if (this.running || !this.ok) return;
    this.running = true;
    this.t0 = performance.now();
    const swing = swingDeg([...WORDS[0]].length) * DEG;
    const tick = (now: number) => {
      if (!this.running) return;
      const elapsed = (now - this.t0) / 1000;
      this.clock = elapsed;

      const want = Math.floor(elapsed / WORD_SECONDS) % WORDS.length;
      if (want !== this.target) {
        this.target = want;
        for (let i = 0; i < this.slots.length; i++) {
          this.flipAt[i] = elapsed + i * FLIP_STAGGER;
        }
      }
      const t = elapsed % PERIOD;
      this.render(detent(swing * Math.sin((2 * Math.PI * t) / PERIOD)));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  renderStill() {
    const first = this.slots[0];
    this.render(first ? -first.u : 0);
  }

  destroy() {
    this.stop();
    this.slots = [];
    this.ctx = null;
  }
}
```

## swing-type/SwingTypeCard.tsx

```tsx
"use client";

import { useEffect, useRef } from "react";
import { SwingType } from "./engine";
import { FONT_VAR, FONT_WEIGHT } from "./params";
import { onTransitionChange } from "../../lib/view-transition";

export function SwingTypeCard({
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

    let engine: SwingType | null = null;
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

      engine = new SwingType(canvas, fam);
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
      aria-label="Large coloured letters swing slowly back and forth across a white field. Each letter turns edge-on as it travels, thinning to a coloured sliver at the sides and opening to full width in the middle, so only two or three letters can be read at any moment and the whole word never appears at once. Every few seconds the word quietly becomes a different one."
      style={{
        ...(viewTransitionName ? { viewTransitionName } : null),
        backgroundColor: "#000",
      }}
      className="relative mx-auto aspect-[1344/620] w-full select-none overflow-hidden rounded-[12px] border border-[var(--border-line)]"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
```
