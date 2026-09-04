import type { ReactNode } from "react";

export const CARD_VW = 640;
export const CARD_VH = 360;

export const PG_VW = 720;
export const PG_VH = 380;

export const COMPACT_VW = 360;
export const COMPACT_VH = 202;

export const CARD_DIV = 460;
export const PG_DIV = 720;

export const COMPACT_CARD_DIV = 380;
export const COMPACT_PG_DIV = 430;

export const MOBILE_QUERY = "(max-width: 639px)";

export interface ScenePiece {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  content?: ReactNode;
}

export interface SceneSpec {
  k: number;

  cell: number;
  pieces: ScenePiece[];
}

export interface SceneSet {
  vw: number;
  vh: number;
  cardDiv: number;
  pgDiv: number;
  cardRadius: number;

  card: SceneSpec[];

  playground: SceneSpec[];
}

const swatch = "rounded-[6px] bg-[var(--bg-hover)]";

const bar = (w: string, h: string) => (
  <div className={`${h} rounded-full bg-[var(--bg-hover)]`} style={{ width: w }} />
);

function GridBody({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`grid h-full grid-cols-2 grid-rows-2 ${compact ? "gap-1.5 p-2 pt-2.5" : "gap-1.5 p-2 pt-2.5"}`}
    >
      <div className={swatch} />
      <div className={swatch} />
      <div className={swatch} />
      <div className={swatch} />
    </div>
  );
}

/** A small text label (the "Grid" / "Share" tab). */
function Label({ children, compact = false, center = false }: { children: ReactNode; compact?: boolean; center?: boolean }) {
  return (
    <div
      className={`flex h-full items-center ${center ? "justify-center pl-1" : "px-3 pb-1"}`}
    >
      <span
        className={`font-semibold text-[var(--text-secondary)] ${compact ? "text-[13px]" : "text-[11px]"}`}
      >
        {children}
      </span>
    </div>
  );
}

function BubbleBody({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex h-full items-center ${compact ? "gap-3 px-4" : "gap-2.5 px-4"}`}>
      <div
        className={`${compact ? "size-10" : "size-9"} shrink-0 rounded-full bg-[var(--bg-hover)]`}
      />
      <div className="flex flex-1 flex-col gap-1.5">
        {bar("80%", compact ? "h-2.5" : "h-2")}
        {bar("55%", compact ? "h-2.5" : "h-2")}
      </div>
    </div>
  );
}

function ShareBody({ compact = false }: { compact?: boolean }) {
  const av = `${compact ? "size-9" : "size-8"} rounded-full border-2 border-[var(--bg-surface)] bg-[var(--bg-hover)]`;
  return (
    <div className="flex h-full items-center gap-3 px-4">
      <div className="flex -space-x-2">
        <div className={av} />
        <div className={av} />
        <div className={av} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {bar("70%", compact ? "h-2.5" : "h-2")}
        {bar("45%", compact ? "h-2.5" : "h-2")}
      </div>
    </div>
  );
}

/** The search-bar input line. */
function SearchBody({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full items-center px-5">
      {bar("55%", compact ? "h-3" : "h-2.5")}
    </div>
  );
}

function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-[var(--text-secondary)]">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
    </div>
  );
}

const CARD_SCENES: SceneSpec[] = [

  {
    k: 20,
    cell: 6,
    pieces: [
      { id: "main", x: 170, y: 82, w: 300, h: 196, radius: 22, content: <GridBody /> },
      { id: "tab", x: 178, y: 46, w: 92, h: 46, radius: 18, content: <Label>Grid</Label> },
    ],
  },
  // Chat bubble — avatar + message lines, tail fused at the bottom-right.
  {
    k: 30,
    cell: 6,
    pieces: [
      { id: "main", x: 160, y: 128, w: 300, h: 108, radius: 40, content: <BubbleBody /> },
      { id: "tab", x: 428, y: 206, w: 50, h: 50, radius: 14 },
    ],
  },
  // Share card — avatar stack + a "Share" button fused to the right edge (gooey).
  {
    k: 60,
    cell: 6,
    pieces: [
      { id: "main", x: 150, y: 120, w: 280, h: 116, radius: 26, content: <ShareBody /> },
      { id: "tab", x: 418, y: 151, w: 90, h: 54, radius: 18, content: <Label center>Share</Label> },
    ],
  },
];

// The playground's four presets, hand-placed by dragging in the playground
// itself, in the wider 720×380 stage (absolute coords, no auto-centering).
const PG_SCENES: SceneSpec[] = [
  // 1 · Chat bubble — tail fused at the bottom-right (a sent message).
  {
    k: 28,
    cell: 12,
    pieces: [
      { id: "bubble", x: 188, y: 123, w: 300, h: 116, radius: 40, content: <BubbleBody /> },
      { id: "tail", x: 472, y: 212, w: 52, h: 52, radius: 14 },
    ],
  },
  // 2 · Grid panel — a "Grid" tab fused at the top-left.
  {
    k: 20,
    cell: 12,
    pieces: [
      { id: "tab", x: 178, y: 80, w: 92, h: 46, radius: 18, content: <Label>Grid</Label> },
      { id: "panel", x: 247, y: 104, w: 300, h: 196, radius: 22, content: <GridBody /> },
    ],
  },
  // 3 · Share card — a "Share" button fused to the right edge with a gooey neck.
  {
    k: 77,
    cell: 11,
    pieces: [
      { id: "card", x: 176, y: 131, w: 288, h: 120, radius: 26, content: <ShareBody /> },
      { id: "btn", x: 483, y: 165, w: 96, h: 52, radius: 18, content: <Label center>Share</Label> },
    ],
  },
  // 4 · Search bar — a pill input with a round button fused near the right end.
  {
    k: 20,
    cell: 3,
    pieces: [
      { id: "input", x: 208, y: 167, w: 300, h: 64, radius: 32, content: <SearchBody /> },
      { id: "go", x: 452, y: 132, w: 56, h: 56, radius: 26, content: <SearchIcon /> },
    ],
  },
];

// ── Compact (mobile) scenes ──────────────────────────────────────────────────
// Re-placed for the 360×202 space rather than rescaled: the compositions are
// tighter and more vertical, the bodies are proportionally larger relative to the
// frame, and every draggable appendage is at least 60 design-px so it stays a
// comfortable touch target once the ~1.0 compact scale is applied.
//
// `cell` is raised across the board. It's a grid step in FIELD units, so a small
// cell in a small space oversamples badly — the compact space is ~half the width
// of the desktop one, so the same visual crispness needs roughly half the cell
// count, and the weakest devices are the ones running it.
const COMPACT_CARD_SCENES: SceneSpec[] = [
  // Grid panel — tab tucked at the top-left of the body.
  {
    k: 16,
    cell: 5,
    pieces: [
      { id: "main", x: 76, y: 49, w: 208, h: 132, radius: 20, content: <GridBody compact /> },
      { id: "tab", x: 84, y: 21, w: 78, h: 38, radius: 15, content: <Label compact>Grid</Label> },
    ],
  },
  // Chat bubble — tail fused at the bottom-right.
  {
    k: 22,
    cell: 5,
    pieces: [
      { id: "main", x: 64, y: 62, w: 232, h: 92, radius: 32, content: <BubbleBody compact /> },
      { id: "tab", x: 262, y: 128, w: 46, h: 46, radius: 13 },
    ],
  },
  // Share card — button fused to the right edge (gooey).
  {
    k: 44,
    cell: 5,
    pieces: [
      { id: "main", x: 46, y: 60, w: 210, h: 96, radius: 22, content: <ShareBody compact /> },
      { id: "tab", x: 246, y: 78, w: 74, h: 48, radius: 16, content: <Label compact center>Share</Label> },
    ],
  },
];

const COMPACT_PG_SCENES: SceneSpec[] = [
  // 1 · Chat bubble + tail. The tail is the smallest draggable piece anywhere, so
  //     it sets the floor: 64px keeps it a usable target even on a 320px phone.
  {
    k: 22,
    cell: 6,
    pieces: [
      { id: "bubble", x: 52, y: 56, w: 232, h: 92, radius: 32, content: <BubbleBody compact /> },
      { id: "tail", x: 250, y: 120, w: 64, h: 64, radius: 17 },
    ],
  },
  // 2 · Grid panel + tab. The tab is short by nature, so it's the piece most at risk
  //     of becoming an unusable target — 64 tall keeps it draggable, and the panel
  //     drops to meet it so the pair still reads as a tab fused to a panel.
  {
    k: 16,
    cell: 6,
    pieces: [
      { id: "tab", x: 60, y: 18, w: 92, h: 64, radius: 20, content: <Label compact>Grid</Label> },
      { id: "panel", x: 96, y: 62, w: 204, h: 122, radius: 20, content: <GridBody compact /> },
    ],
  },
  // 3 · Share card + button, gooey neck.
  {
    k: 52,
    cell: 6,
    pieces: [
      { id: "card", x: 40, y: 56, w: 204, h: 100, radius: 22, content: <ShareBody compact /> },
      { id: "btn", x: 242, y: 74, w: 82, h: 64, radius: 20, content: <Label compact center>Share</Label> },
    ],
  },
  // 4 · Search bar + go button, both at the 64px floor.
  {
    k: 16,
    cell: 5,
    pieces: [
      { id: "input", x: 42, y: 80, w: 224, h: 64, radius: 32, content: <SearchBody compact /> },
      { id: "go", x: 238, y: 50, w: 64, h: 64, radius: 29, content: <SearchIcon size={22} /> },
    ],
  },
];

// ── The two sets ─────────────────────────────────────────────────────────────
export const DESKTOP_SET: SceneSet = {
  vw: PG_VW,
  vh: PG_VH,
  cardDiv: CARD_DIV,
  pgDiv: PG_DIV,
  cardRadius: 26,
  card: CARD_SCENES,
  playground: PG_SCENES,
};

export const COMPACT_SET: SceneSet = {
  vw: COMPACT_VW,
  vh: COMPACT_VH,
  cardDiv: COMPACT_CARD_DIV,
  pgDiv: COMPACT_PG_DIV,
  cardRadius: 20,
  card: COMPACT_CARD_SCENES,
  playground: COMPACT_PG_SCENES,
};

/** The card/hero uses its own space (640×360) on desktop but shares the compact
 *  space on mobile — so the two sets differ in `vw`/`vh` for the card path. */
export const CARD_SPACE = { vw: CARD_VW, vh: CARD_VH };
export const COMPACT_CARD_SPACE = { vw: COMPACT_VW, vh: COMPACT_VH };
