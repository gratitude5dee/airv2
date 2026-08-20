/**
 * PixelIcon — the Pixel OS glyph set (spec §1): 8×8 bitmaps rendered as SVG
 * rects in currentColor with crisp edges. These replace lucide-style icons in
 * the nav and on app tiles; dense panel bodies keep whatever they use today.
 * Deterministic per-app fallback stays with DitherAvatar (same hash family).
 */
import type { CSSProperties } from "react";

const GLYPHS = {
  chat: ["........", ".XXXXXX.", ".X....X.", ".X....X.", ".XXXXXX.", "...X....", "..X.....", "........"],
  computer: ["........", ".XXXXXX.", ".X....X.", ".X....X.", ".XXXXXX.", "...XX...", "..XXXX..", "........"],
  store: ["...XX...", "..X..X..", ".XXXXXX.", ".X....X.", ".X....X.", ".X....X.", ".XXXXXX.", "........"],
  grid: ["........", ".XX..XX.", ".XX..XX.", "........", ".XX..XX.", ".XX..XX.", "........", "........"],
  ads: ["......X.", "....XXX.", "..XXXXX.", ".XXXXXX.", "..XXXXX.", "....XXX.", "...X..X.", "...XX..."],
  wrench: [".XX..XX.", ".XXXXXX.", "..XXXX..", "...XX...", "...XX...", "...XX...", "...XX...", "........"],
  bell: ["...XX...", "..XXXX..", "..XXXX..", ".XXXXXX.", ".XXXXXX.", "XXXXXXXX", "...XX...", "........"],
  cal: ["........", ".X.XX.X.", ".XXXXXX.", ".X....X.", ".X.XX.X.", ".X.XX.X.", ".XXXXXX.", "........"],
  clock: ["..XXXX..", ".X....X.", ".X..X.X.", ".X..XX..", ".X....X.", "..XXXX..", "........", "........"],
  people: ["..XX....", "..XX....", ".XXXX...", "....XX..", "....XX..", "...XXXX.", "........", "........"],
  chip: ["..X..X..", ".XXXXXX.", "XX....XX", ".X.XX.X.", "XX....XX", ".XXXXXX.", "..X..X..", "........"],
  wallet: ["........", ".XXXXXX.", ".X....X.", ".X..XXX.", ".X..XXX.", ".X....X.", ".XXXXXX.", "........"],
  lock: ["..XXXX..", ".X....X.", ".X....X.", "XXXXXXXX", "XXX..XXX", "XXX..XXX", "XXXXXXXX", "........"],
  card: ["........", "XXXXXXXX", "X......X", "XXXXXXXX", "X......X", "X.XX...X", "XXXXXXXX", "........"],
  dollar: ["...XX...", "..XXXX..", ".XX.....", "..XXXX..", ".....XX.", "..XXXX..", "...XX...", "........"],
  gear: ["..X..X..", ".XXXXXX.", "XX.XX.XX", ".X.XX.X.", "XX.XX.XX", ".XXXXXX.", "..X..X..", "........"],
  plug: [".X..X...", ".X..X...", "XXXXXX..", ".XXXX...", ".XXXX...", "..XX....", "..XX....", "........"],
  bolt: ["....XX..", "...XX...", "..XXXX..", "....XX..", "...XX...", "..XX....", "........", "........"],
  inbox: ["........", ".XXXXXX.", ".X....X.", ".X....X.", "XXX..XXX", "X.XXXX.X", "XXXXXXXX", "........"],
  crm: ["..X..X..", ".XXX.XXX", ".XXX.XXX", "........", ".XXXXXX.", ".X....X.", ".XXXXXX.", "........"],
  image: ["........", ".XXXXXX.", ".X..X.X.", ".X.XXX.X", ".XXXXXX.", ".X....X.", ".XXXXXX.", "........"],
  video: ["........", ".XXXX...", ".X..XXX.", ".X..XXX.", ".XXXX...", "........", ".XXXXXX.", "........"],
  todo: ["........", ".XX.....", "..XX..X.", "...XXX..", "....X...", ".XX.....", "..XX....", "........"],
  kanban: ["........", ".XX.X.X.", ".XX.X.X.", ".XX.X...", ".XX.....", "........", "........", "........"],
  shop: ["........", "XXXXXXXX", ".X....X.", ".X....X.", "..XXXX..", "..X..X..", "..XXXX..", "........"],
  analytics: ["........", "......X.", "....X.X.", "..X.X.X.", "X.X.X.X.", "X.X.X.X.", "XXXXXXXX", "........"],
  pay: ["...XX...", "..XXXX..", ".XX..X..", "..XXXX..", "..X..XX.", "..XXXX..", "...XX...", "........"],
  key: ["..XXX...", ".X...X..", ".X...X..", "..XXX...", "...X....", "...XX...", "...X.X..", "...XX..."],
  note: ["........", ".XXXXX..", ".X...XX.", ".X....X.", ".X.XX.X.", ".X.XX.X.", ".XXXXXX.", "........"],
  eye: ["........", "..XXXX..", ".X....X.", "X..XX..X", "X..XX..X", ".X....X.", "..XXXX..", "........"],
  eyeoff: ["X.......", ".X.XXX..", "..X...X.", "X..X...X", "X...X..X", ".X...X..", "..XXXX.X", ".......X"],
  browser: ["........", "XXXXXXXX", "X.X....X", "XXXXXXXX", "X......X", "X......X", "XXXXXXXX", "........"],
} as const;

export type PixelGlyph = keyof typeof GLYPHS;

export const PIXEL_GLYPHS = Object.keys(GLYPHS) as PixelGlyph[];

/** First-party app slugs → glyphs. Unknown slugs fall back to DitherAvatar. */
const APP_GLYPHS: Record<string, PixelGlyph> = {
  computer: "computer",
  browser: "browser",
  connect: "plug",
  onboarding: "bolt",
  settings: "gear",
  calendar: "cal",
  inbox: "inbox",
  crm: "crm",
  analytics: "analytics",
  video: "video",
  image: "image",
  shop: "shop",
  pay: "pay",
  vault: "lock",
  kanban: "kanban",
  todo: "todo",
  ads: "ads",
};

export function appGlyph(slug: string): PixelGlyph | null {
  return APP_GLYPHS[slug] ?? null;
}

const CRISP: CSSProperties = { shapeRendering: "crispEdges", display: "block" };

export function PixelIcon({
  glyph,
  size = 16,
  className,
  title,
}: {
  glyph: PixelGlyph;
  size?: number;
  className?: string;
  title?: string;
}) {
  const bitmap = GLYPHS[glyph];
  const rects: React.ReactElement[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (bitmap[y]?.[x] === "X") {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
      }
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="currentColor"
      style={CRISP}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {rects}
    </svg>
  );
}
