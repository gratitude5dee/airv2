/**
 * The Kit allowlist. Adding a component means adding an entry here and running
 * `harvest.ts` — never editing files under kit/ by hand (§12.4).
 *
 * `files[].from` is relative to the source pin (see sources.ts); `to` is the
 * file name inside `kit/<source>/<name>/`. Files with `air: true` have no
 * upstream — they are glue written for the Kit and hash with `upstream: null`.
 */
import type { SourceId } from "./sources.ts";

export type ReducedMotion = "static" | "reduced" | "none" | "n/a";
export type Kind = "component" | "helper" | "style";

export interface KitFile {
  readonly from?: string;
  readonly to: string;
  /** Kit-authored glue; body lives in scripts/glue/<source>/<to>. */
  readonly air?: boolean;
}

export interface Patch {
  readonly file: string;
  readonly find: string | RegExp;
  readonly replace: string;
  /** Patch may legitimately not match (e.g. optional demo block). */
  readonly optional?: boolean;
}

export interface ComponentSpec {
  readonly id: string;
  readonly source: SourceId;
  readonly title: string;
  readonly tags: readonly string[];
  readonly when: string;
  readonly files: readonly KitFile[];
  /** Entry file for measurement and the harness. Default `index.tsx`. */
  readonly entry?: string;
  /** Named export rendered by the harness; default is the first PascalCase export. */
  readonly demoExport?: string;
  /** Vendor packages the component imports (bare specifiers). */
  readonly deps: readonly string[];
  /** Author-declared props when the interface cannot be extracted. Merged over extraction. */
  readonly props?: Readonly<Record<string, string>>;
  /** `never`: non-lite by policy regardless of measurement (WebGL, physics, blur-heavy). */
  readonly litePolicy: "auto" | "never";
  /** Why `litePolicy` is `never`; recorded as meta.liteReason. */
  readonly litePolicyReason?: string;
  readonly touch: boolean;
  readonly reducedMotion: ReducedMotion;
  readonly kind?: Kind;
  readonly patches?: readonly Patch[];
  /** Failure modes / caveats surfaced in ref.md. */
  readonly notes?: readonly string[];
  /** Upstream author, when different from the source author. */
  readonly author?: string;
  /** Props the headless harness mounts the component with. Default `{ text, children }`. */
  readonly demo?: Readonly<Record<string, unknown>>;
  /** Usage sketch for ref.md (JSX). Generated from title/props when omitted. */
  readonly usage?: string;
  /** Registry item name when it differs from the Kit name (registry sources only). */
  readonly registryItem?: string;
}

const FANCY_TEXT = "fancy/components/text/";
const FANCY_BLOCKS = "fancy/components/blocks/";
const FANCY_FILTER = "fancy/components/filter/";
const FANCY_BG = "fancy/components/background/";
const FANCY_PHYS = "fancy/components/physics/";
const FANCY_HOOKS = "hooks/";

const USE_DIMENSIONS: KitFile = { from: `${FANCY_HOOKS}use-dimensions.ts`, to: "use-dimensions.ts" };

function fancy(
  name: string,
  dir: string,
  spec: Omit<ComponentSpec, "id" | "source" | "files"> & { readonly extraFiles?: readonly KitFile[] }
): ComponentSpec {
  const { extraFiles = [], ...rest } = spec;
  return {
    id: `fancy/${name}`,
    source: "fancy",
    files: [{ from: `${dir}${name}.tsx`, to: "index.tsx" }, ...extraFiles],
    ...rest,
  };
}

const LODASH_DEBOUNCE: Patch = {
  file: "index.tsx",
  find: 'import { debounce } from "lodash"\n',
  replace:
    "\nfunction debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {\n" +
    "  let t: ReturnType<typeof setTimeout> | undefined\n" +
    "  return (...args: A) => {\n    if (t) clearTimeout(t)\n    t = setTimeout(() => fn(...args), wait)\n  }\n}\n",
};

export const FANCY: readonly ComponentSpec[] = [
  fancy("typewriter", FANCY_TEXT, {
    title: "Typewriter",
    demo: { text: "Hello, Air" },
    tags: ["text", "motion", "hero", "status"],
    when: "A headline or status line that should feel typed by someone; not for body copy.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("text-rotate", FANCY_TEXT, {
    title: "Text Rotate",
    demo: { texts: ["one", "two", "three"] },
    tags: ["text", "motion", "hero"],
    when: "One slot in a headline that cycles through a short list of words.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("scramble-in", FANCY_TEXT, {
    title: "Scramble In",
    demo: { text: "Hello, Air" },
    tags: ["text", "motion", "reveal"],
    when: "Reveal a short label by unscrambling it once on mount or on view.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("scramble-hover", FANCY_TEXT, {
    title: "Scramble Hover",
    demo: { text: "Hello, Air" },
    tags: ["text", "motion", "hover"],
    when: "A nav label that scrambles on hover/focus. Hover-only flourish; no touch equivalent.",
    deps: [],
    litePolicy: "auto",
    touch: false,
    reducedMotion: "none",
  }),
  fancy("vertical-cut-reveal", FANCY_TEXT, {
    title: "Vertical Cut Reveal",
    tags: ["text", "motion", "reveal", "hero"],
    when: "Reveal a headline line by line (or word by word) with a clipped upward slide.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("breathing-text", FANCY_TEXT, {
    title: "Breathing Text",
    tags: ["text", "motion", "ambient"],
    when: "A single word whose weight/width breathes slowly. Ambient only; never for status.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    notes: ["Animates font-variation-settings; only visible with a variable font (Air 'Newsreader'/'Azeret Mono' are variable)."],
  }),
  fancy("letter-swap-forward-anim", FANCY_TEXT, {
    title: "Letter Swap (forward)",
    demo: { label: "Hello" },
    tags: ["text", "motion", "hover", "nav"],
    when: "Nav/button label whose letters roll upward on hover. Hover-only.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: false,
    reducedMotion: "none",
  }),
  fancy("letter-swap-pingpong-anim", FANCY_TEXT, {
    title: "Letter Swap (ping-pong)",
    demo: { label: "Hello" },
    tags: ["text", "motion", "hover", "nav"],
    when: "Like Letter Swap (forward) but rolls back on hover-out. Hover-only.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: false,
    reducedMotion: "none",
    patches: [LODASH_DEBOUNCE],
  }),
  fancy("random-letter-swap-forward-anim", FANCY_TEXT, {
    title: "Random Letter Swap (forward)",
    demo: { label: "Hello" },
    tags: ["text", "motion", "hover", "nav"],
    when: "Letter Swap with randomized per-letter direction. Hover-only.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: false,
    reducedMotion: "none",
    patches: [LODASH_DEBOUNCE],
  }),
  fancy("random-letter-swap-pingpong-anim", FANCY_TEXT, {
    title: "Random Letter Swap (ping-pong)",
    demo: { label: "Hello" },
    tags: ["text", "motion", "hover", "nav"],
    when: "Randomized Letter Swap that rolls back on hover-out. Hover-only.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: false,
    reducedMotion: "none",
    patches: [LODASH_DEBOUNCE],
  }),
  fancy("letter-3d-swap", FANCY_TEXT, {
    title: "Letter 3D Swap",
    tags: ["text", "motion", "hover", "3d"],
    when: "Letters flip on a 3D axis on hover. Hover-only; heavier than the 2D swaps.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: false,
    reducedMotion: "none",
  }),
  fancy("underline-center", FANCY_TEXT, {
    title: "Underline (center)",
    tags: ["text", "link", "hover", "motion"],
    when: "Inline link whose underline grows from the center on hover/focus.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  fancy("underline-comes-in-goes-out", FANCY_TEXT, {
    title: "Underline (comes in, goes out)",
    tags: ["text", "link", "hover", "motion"],
    when: "Inline link underline that enters from one side and exits the other.",
    deps: ["motion", "clsx"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  fancy("underline-goes-out-comes-in", FANCY_TEXT, {
    title: "Underline (goes out, comes in)",
    tags: ["text", "link", "hover", "motion"],
    when: "Inline link underline that leaves before re-entering on hover.",
    deps: ["motion", "clsx"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  fancy("underline-to-background", FANCY_TEXT, {
    title: "Underline to Background",
    tags: ["text", "link", "hover", "motion"],
    when: "Link underline that swells into a highlight on hover; good for a single CTA link.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  fancy("basic-number-ticker", FANCY_TEXT, {
    title: "Number Ticker",
    tags: ["number", "motion", "hero", "status", "countdown"],
    when: "A number that counts to its value: RSVP totals, countdowns, prices.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("text-highlighter", FANCY_TEXT, {
    title: "Text Highlighter",
    tags: ["text", "motion", "emphasis"],
    when: "Marker-style highlight that sweeps across a phrase when it scrolls into view.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("text-along-path", FANCY_TEXT, {
    title: "Text Along Path",
    tags: ["text", "svg", "motion", "hero"],
    when: "Text set along an SVG path (circles, arcs). Decorative headers only.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("simple-marquee", FANCY_BLOCKS, {
    title: "Simple Marquee",
    tags: ["layout", "motion", "gallery", "ambient"],
    when: "Endless horizontal strip of logos, photos or words. Pauses on reduced motion.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("stacking-cards", FANCY_BLOCKS, {
    title: "Stacking Cards",
    tags: ["layout", "scroll", "cards"],
    when: "Sections that stack as the page scrolls. Needs at least three cards to read.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  fancy("simple-carousel", FANCY_BLOCKS, {
    title: "Simple Carousel",
    tags: ["layout", "gallery", "touch"],
    when: "Swipeable horizontal carousel with snap; the gallery recipe default.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  fancy("float", FANCY_BLOCKS, {
    title: "Float",
    tags: ["motion", "ambient", "decor"],
    when: "Gentle idle float for a hero image or badge. One per screen.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("circling-elements", FANCY_BLOCKS, {
    title: "Circling Elements",
    tags: ["motion", "ambient", "decor", "gallery"],
    when: "Small items orbiting a center: avatars around a host, badges around a logo.",
    deps: ["clsx", "tailwind-merge"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("screensaver", FANCY_BLOCKS, {
    title: "Screensaver",
    demo: { children: "hi", containerRef: { $ref: "root" } },
    tags: ["motion", "ambient", "decor"],
    when: "DVD-logo bounce for a badge inside a container. Ambient only.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    extraFiles: [USE_DIMENSIONS],
  }),
  fancy("css-box", FANCY_BLOCKS, {
    title: "CSS Box",
    tags: ["3d", "motion", "hero", "gallery"],
    when: "A CSS 3D cube with a face per side; rotate to show six images or words.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("media-between-text", FANCY_BLOCKS, {
    title: "Media Between Text",
    tags: ["text", "media", "motion", "hero"],
    when: "Headline where an image expands between two words on hover/view.",
    deps: ["motion"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  fancy("gooey-svg-filter", FANCY_FILTER, {
    title: "Gooey SVG Filter",
    tags: ["filter", "svg", "helper"],
    when: "Provides an SVG goo filter by id for blobby merges. Pair with liquid-gooey only when that package is too heavy.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    kind: "helper",
  }),
  fancy("pixelate-svg-filter", FANCY_FILTER, {
    title: "Pixelate SVG Filter",
    tags: ["filter", "svg", "helper"],
    when: "Provides an SVG pixelation filter by id; apply to an image that resolves on load.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    kind: "helper",
  }),
  fancy("animated-gradient-with-svg", FANCY_BG, {
    title: "Animated Gradient (SVG)",
    demo: { colors: ["#5b8cff", "#ff8a5b", "#7cffb2"] },
    tags: ["background", "motion", "ambient"],
    when: "Soft moving color blobs behind a panel. Uses blur; pixel theme and lite render it flat.",
    deps: ["clsx", "tailwind-merge"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    extraFiles: [{ from: `${FANCY_HOOKS}use-debounced-dimensions.ts`, to: "use-debounced-dimensions.ts" }],
  }),
  fancy("pixel-trail", FANCY_BG, {
    title: "Pixel Trail",
    tags: ["background", "pointer", "motion"],
    when: "Pixels light up under the pointer/finger. Decorative background for one screen.",
    deps: ["motion", "clsx", "tailwind-merge"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "none",
    extraFiles: [USE_DIMENSIONS],
    patches: [
      { file: "index.tsx", find: 'import { v4 as uuidv4 } from "uuid"\n', replace: "" },
      { file: "index.tsx", find: "const trailId = useRef(uuidv4())", replace: "const trailId = useRef(useId().replace(/:/g, \"\"))" },
      { file: "index.tsx", find: /import React, \{ ([^}]*)\} from "react"/, replace: 'import React, { $1, useId } from "react"' },
    ],
  }),
  fancy("elastic-line", FANCY_PHYS, {
    title: "Elastic Line",
    tags: ["physics", "pointer", "motion", "divider"],
    when: "A divider line that stretches toward the pointer and snaps back. Non-lite (physics).",
    deps: ["motion"],
    litePolicy: "never",
    litePolicyReason: "policy: continuous pointer physics (rAF spring) is too costly for the lite webview",
    touch: false,
    reducedMotion: "static",
    extraFiles: [
      USE_DIMENSIONS,
      { from: `${FANCY_HOOKS}use-elastic-line-events.ts`, to: "use-elastic-line-events.ts" },
      { from: `${FANCY_HOOKS}use-mouse-position.ts`, to: "use-mouse-position.ts" },
    ],
  }),
];

function aicss(
  name: string,
  dir: string,
  file: string,
  spec: Omit<ComponentSpec, "id" | "source" | "files" | "entry">
): ComponentSpec {
  return {
    id: `aicss/${name}`,
    source: "aicss",
    entry: "index.ts",
    files: [
      { from: `${dir}/index.ts`, to: "index.ts" },
      { from: `${dir}/${file}.tsx`, to: `${file}.tsx` },
      { from: `${dir}/${file}.module.css`, to: `${file}.module.css` },
    ],
    ...spec,
  };
}

export const AICSS: readonly ComponentSpec[] = [
  aicss("thinking-state", "thinking-state", "ThinkingState", {
    title: "Thinking State",
    tags: ["ai", "status", "loading", "thinking"],
    when: "The agent is working and you have a verb for it. Default for the status/thinking recipe.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  aicss("thinking-reasoning", "thinking-reasoning", "ThinkingReasoning", {
    title: "Thinking Reasoning",
    tags: ["ai", "status", "disclosure", "thinking"],
    when: "Collapsible reasoning trace under a thinking indicator.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  aicss("orbs", "orbs", "Orb", {
    title: "Orb",
    tags: ["ai", "status", "avatar", "ambient"],
    when: "Ambient CSS orb as the agent's presence. Use thinking-orbs when you need named states.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  aicss("text-response", "text-response", "TextResponse", {
    title: "Text Response",
    tags: ["ai", "chat", "text"],
    when: "A finished agent reply with light markdown-ish structure.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  aicss("streaming-text", "streaming-text", "StreamingText", {
    title: "Streaming Text",
    demo: { text: "Streaming reply text" },
    tags: ["ai", "chat", "text", "streaming"],
    when: "Token-by-token reveal of an incoming reply.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  aicss("code-block", "code-block", "CodeBlock", {
    title: "Code Block",
    demo: { lang: "ts", code: "const a = 1;" },
    tags: ["code", "chat", "text"],
    when: "Monospace block with a copy affordance; no highlighter dependency.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  aicss("todo-list", "task-list", "TodoList", {
    title: "Todo List",
    tags: ["list", "tasks", "status"],
    when: "Agent task checklist with pending/active/done rows.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  aicss("data-table", "data-table", "DataTable", {
    title: "Data Table",
    tags: ["table", "data"],
    when: "Small read-only data table inside a reply. For sorting/filtering use beautiful/filter-table.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  aicss("agent-input", "ai-agent-input", "PromptInput", {
    title: "Agent Input",
    tags: ["input", "chat", "composer"],
    when: "Prompt composer with attachments and send. Default composer for the chat recipe.",
    deps: ["lucide-react"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  aicss("approval-card", "approval-card", "ApprovalCard", {
    title: "Approval Card",
    tags: ["approval", "decision", "card", "actions"],
    when: "Approve/deny a proposed action with a short summary. Default for the approval recipe.",
    deps: ["lucide-react"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
];

const BUI_P = "components/primitives/";
const BUI_A = "components/atoms/";

const BUI_IMPORT_PATCHES: readonly Patch[] = [
  { file: "index.tsx", find: /import \{ Button \} from "@\/components\/atoms\/Button";?\n/, replace: 'import { Button } from "../button";\n', optional: true },
  { file: "index.tsx", find: /import GlideMenu from "@\/components\/primitives\/GlideMenu";?\n/, replace: 'import GlideMenu from "../glide-menu";\n', optional: true },
  { file: "index.tsx", find: /import \{ EntityChip \} from "@\/components\/atoms\/EntityChip";?\n/, replace: 'import { EntityChip } from "../entity-chip";\n', optional: true },
  { file: "index.tsx", find: /import \{ ValuePill \} from "@\/components\/atoms\/ValuePill";?\n/, replace: 'import { ValuePill } from "../value-pill";\n', optional: true },
  { file: "index.tsx", find: /import \{ Shimmer \} from "@\/components\/atoms\/Shimmer";?\n/, replace: 'import { Shimmer } from "../shimmer";\n', optional: true },
  { file: "index.tsx", find: /import \{ StreamText \} from "@\/components\/atoms\/StreamText";?\n/, replace: 'import { StreamText } from "../stream-text";\n', optional: true },
];

function bui(
  name: string,
  file: string,
  spec: Omit<ComponentSpec, "id" | "source" | "files"> & { readonly extraFiles?: readonly KitFile[] }
): ComponentSpec {
  const { extraFiles = [], patches = [], ...rest } = spec;
  return {
    id: `beautiful/${name}`,
    source: "beautiful",
    files: [{ from: file, to: "index.tsx" }, ...extraFiles],
    patches: [...BUI_IMPORT_PATCHES, ...patches],
    ...rest,
  };
}

export const BEAUTIFUL: readonly ComponentSpec[] = [
  {
    id: "beautiful/foundation",
    source: "beautiful",
    title: "Beautiful UI foundation",
    tags: ["style", "tokens", "helper"],
    when: "Shared CSS for every beautiful/* component: token bridge onto Air, keyframes, primitive classes. Import once.",
    files: [
      { from: "app/beautifui/foundation.css", to: "foundation.css" },
      { to: "index.ts", air: true },
    ],
    entry: "index.ts",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    kind: "style",
    patches: [
      {
        file: "foundation.css",
        find: "  .records-footer-hint {\n    display: none;\n  }\n}\n\n",
        replace: "",
      },
    ],
    notes: ["Upstream foundation.css carries an orphaned `.records-footer-hint {} }` fragment (unbalanced brace); dropped."],
  },
  bui("button", `${BUI_A}Button.tsx`, {
    title: "Button (atom)",
    tags: ["button", "atom", "helper"],
    when: "Beautiful UI button used by its cards and tables. Prefer Air's .row.actions buttons for app chrome.",
    deps: ["clsx", "tailwind-merge"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    kind: "helper",
    patches: [
      { file: "index.tsx", find: 'import { cva, type VariantProps } from "class-variance-authority";\n', replace: "" },
      { file: "index.tsx", find: 'import { cn } from "@/lib/utils";\n', replace: 'import { cn } from "../../air";\nimport { cva, type VariantProps } from "./cva";\n' },
    ],
    extraFiles: [{ to: "cva.ts", air: true }],
  }),
  bui("glide-menu", `${BUI_P}GlideMenu.tsx`, {
    title: "Glide Menu (atom)",
    tags: ["menu", "atom", "helper"],
    when: "Sliding highlight menu used inside approval-card, records-table, search.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
    kind: "helper",
  }),
  bui("entity-chip", `${BUI_A}EntityChip.tsx`, {
    title: "Entity Chip (atom)",
    demo: { name: "Acme" },
    tags: ["chip", "atom", "helper"],
    when: "Small entity chip used by recommendation-card.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    kind: "helper",
  }),
  bui("value-pill", `${BUI_A}ValuePill.tsx`, {
    title: "Value Pill (atom)",
    tags: ["pill", "atom", "helper"],
    when: "Numeric pill used by recommendation-card.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    kind: "helper",
  }),
  bui("shimmer", `${BUI_A}Shimmer.tsx`, {
    title: "Shimmer (atom)",
    tags: ["loading", "atom", "helper"],
    when: "Text shimmer used by selection-actions.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    kind: "helper",
  }),
  bui("stream-text", `${BUI_A}StreamText.tsx`, {
    title: "Stream Text (atom)",
    demo: { text: "Hello, Air" },
    tags: ["text", "streaming", "atom", "helper"],
    when: "Word-stream reveal used by selection-actions.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    kind: "helper",
  }),
  bui("loading-state", `${BUI_P}LoadingState.tsx`, {
    title: "Loading State",
    tags: ["loading", "status", "ai"],
    when: "Full-panel waiting state with a message; pass your own media or none.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    patches: [
      { file: "index.tsx", find: /videoSrc = "https:\/\/[^"]+",/, replace: "videoSrc," },
    ],
    notes: ["Upstream defaulted `videoSrc` to a hosted mp4; the Kit build takes it as an optional prop (no default)."],
  }),
  bui("thinking", `${BUI_P}ThinkingState.tsx`, {
    registryItem: "thinking-state",
    title: "Thinking",
    tags: ["ai", "status", "thinking", "sources"],
    when: "Thinking indicator that lists steps and sources as they arrive.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  bui("streaming-text", `${BUI_P}StreamingText.tsx`, {
    title: "Streaming Text",
    tags: ["ai", "chat", "text", "streaming", "sources"],
    when: "Streaming reply with inline source chips. For plain streaming use aicss/streaming-text.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  bui("approval-card", `${BUI_P}ApprovalCard.tsx`, {
    title: "Approval Card",
    tags: ["approval", "decision", "card", "actions"],
    when: "Rich approval with a glide menu of alternatives. aicss/approval-card is the lighter default.",
    deps: ["clsx", "tailwind-merge"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  bui("tool-chips", `${BUI_P}ToolChips.tsx`, {
    title: "Tool Chips",
    tags: ["ai", "status", "chips", "tools"],
    when: "Row of tool-call chips with running/done states.",
    deps: ["react-dom"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  bui("task-rows", `${BUI_P}TaskRows.tsx`, {
    title: "Task Rows",
    tags: ["list", "tasks", "status"],
    when: "Task rows with progress and owners; heavier than aicss/todo-list.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  bui("chat-composer", `${BUI_P}ChatComposer.tsx`, {
    title: "Chat Composer",
    tags: ["input", "chat", "composer"],
    when: "Multi-line composer with mode pills. aicss/agent-input is the lighter default.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  bui("recommendation-card", `${BUI_P}RecommendationCard.tsx`, {
    title: "Recommendation Card",
    tags: ["card", "decision", "actions"],
    when: "One recommendation with entity chips, a value and accept/skip.",
    deps: ["clsx", "tailwind-merge"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  bui("context-cards", `${BUI_P}ContextCards.tsx`, {
    title: "Context Cards",
    tags: ["cards", "context", "sources"],
    when: "Small stack of context/source cards the agent used.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  bui("diff-table", `${BUI_P}DiffTable.tsx`, {
    title: "Diff Table",
    tags: ["table", "diff", "review"],
    when: "Before/after rows with accept controls.",
    deps: ["clsx", "tailwind-merge"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  bui("records-table", `${BUI_P}RecordsTable.tsx`, {
    title: "Records Table",
    tags: ["table", "data", "records"],
    when: "Spreadsheet-like records grid with sticky first column and column selection. Heavy; one per app.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    extraFiles: [{ from: "app/beautifui/records-table.css", to: "records-table.css" }],
    patches: [
      { file: "index.tsx", find: /^(import .*\n)(?![\s\S]*^import )/m, replace: '$1import "./records-table.css";\n' },
      { file: "index.tsx", find: "href={`https://${row.website}`}", replace: "href={row.website}" },
      { file: "records-table.css", find: /    justify-content: flex-end;\n  \}\n\s*$/, replace: "    justify-content: flex-end;\n  }\n}\n" },
    ],
    notes: [
      "Row `website` is rendered as given (no https:// prefix is added); pass full URLs.",
      "Upstream records-table.css is missing the closing brace of its final @media block; restored.",
    ],
  }),
  bui("filter-table", `${BUI_P}FilterTable.tsx`, {
    title: "Filter Table",
    tags: ["table", "data", "filter"],
    when: "Table with filter chips and sorting.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  bui("search", `${BUI_P}SearchList.tsx`, {
    title: "Search",
    tags: ["search", "list", "input"],
    when: "Search field with a filtered result list and glide highlight.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  bui("flowchart", `${BUI_P}Flowchart.tsx`, {
    title: "Flowchart",
    tags: ["diagram", "svg", "plan"],
    when: "Simple node/edge flowchart for a plan or pipeline.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  bui("code-block", `${BUI_P}CodeBlock.tsx`, {
    title: "Code Block",
    tags: ["code", "text"],
    when: "Code block with line numbers and copy. aicss/code-block is the lighter default.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  bui("fine-tune-card", `${BUI_P}FineTuneCard.tsx`, {
    title: "Fine-tune Card",
    tags: ["card", "settings", "sliders"],
    when: "Card of sliders/toggles to tune a result before confirming.",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  }),
  bui("selection-actions", `${BUI_P}SelectionActions.tsx`, {
    title: "Selection Actions",
    tags: ["actions", "menu", "text", "ai"],
    when: "Floating action bar for a text selection (rewrite, shorten, ask).",
    deps: ["clsx", "tailwind-merge", "lucide-react"],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
    patches: [
      {
        file: "index.tsx",
        find: /import \{\n  ArrowUp,\n  ChatBubbleQuestion,\n  Check,\n  EmojiSatisfied,\n  NavArrowRight,\n  Refresh,\n  Scissor,\n  Spark,\n  TextBox,\n  Xmark,\n\} from "iconoir-react"/,
        replace:
          'import {\n  ArrowUp,\n  MessageCircleQuestion as ChatBubbleQuestion,\n  Check,\n  Smile as EmojiSatisfied,\n  ChevronRight as NavArrowRight,\n  RefreshCw as Refresh,\n  Scissors as Scissor,\n  Sparkles as Spark,\n  TextCursorInput as TextBox,\n  X as Xmark,\n} from "lucide-react"',
      },
    ],
    notes: ["Icons remapped from iconoir-react to lucide-react equivalents (proprietary/extra icon packages are not in the vendor snapshot)."],
  }),
];

function lib(name: string, spec: Omit<ComponentSpec, "id" | "source" | "files">): ComponentSpec {
  return {
    id: `libraries/${name}`,
    source: "libraries",
    files: [{ to: "index.tsx", air: true }],
    ...spec,
  };
}

export const LIBRARIES: readonly ComponentSpec[] = [
  lib("thinking-orbs", {
    title: "Thinking Orbs",
    tags: ["ai", "status", "thinking", "canvas"],
    when: "Nine named agent states (working, searching, solving…) on a 2D canvas. Best 'the agent is doing X' indicator.",
    deps: ["thinking-orbs"],
    props: { state: "'working'|'searching'|'solving'|'listening'|'connecting'|'weaving'|'composing'|'breathing'|'shaping'", size: "20 | 64", speed: "number", paused: "boolean", theme: "'auto'|'dark'|'light'" },
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  lib("border-beam", {
    title: "Border Beam",
    tags: ["decor", "motion", "card", "focus"],
    when: "Animated beam around one card that deserves attention (the pending approval, the live item).",
    deps: ["border-beam"],
    props: { size: "'sm'|'md'|'line'|'pulse-outside'|'pulse-inner'", colorVariant: "'colorful'|'mono'|'ocean'|'sunset'", theme: "'dark'|'light'|'auto'", strength: "number", duration: "number", active: "boolean", borderRadius: "number" },
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  }),
  lib("liquid-gooey", {
    title: "Liquid Gooey",
    tags: ["motion", "menu", "decor", "svg"],
    when: "Items that merge like liquid: a plus-menu that splits into droplets, a tab thumb that trails.",
    deps: ["liquid-gooey"],
    props: { blur: "number", contrast: "number", fill: "string", shadow: "string", children: "Liquid.Item[]" },
    litePolicy: "auto",
    touch: true,
    reducedMotion: "reduced",
  }),
  lib("metal-fx", {
    title: "Metal FX",
    tags: ["shader", "webgl", "decor", "hero"],
    when: "Liquid-metal surface behind a hero word. Non-lite only; renders a flat plate when WebGL is off.",
    deps: ["metal-fx"],
    props: { children: "ReactNode", speed: "number", intensity: "number" },
    litePolicy: "never",
    litePolicyReason: "policy: WebGL shader surface; lite has no WebGL",
    touch: true,
    reducedMotion: "static",
    notes: ["Apache-2.0 shader attribution from upstream NOTICE is preserved in evidence/libraries/metal-fx.NOTICE and must ship with any app that bundles it."],
  }),
];

export const ARLAN: readonly ComponentSpec[] = [
  {
    id: "arlan/squircle",
    source: "arlan",
    title: "Squircle",
    tags: ["shape", "button", "card", "svg"],
    when: "True superellipse corners for a button or card via clip-path; the Air pill radius but smoother.",
    files: [
      { from: "squircle/Squircle.tsx", to: "index.tsx" },
      { from: "squircle/superellipse.ts", to: "superellipse.ts" },
      { from: "squircle/tokens.ts", to: "tokens.ts" },
    ],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
  },
  {
    id: "arlan/typer",
    source: "arlan",
    title: "Typer",
    tags: ["text", "motion", "hero", "status"],
    when: "Eased typing with in/out variations as a vanilla class plus a React wrapper; alternative to fancy/typewriter when you need the out-animation.",
    files: [
      { from: "typer/standalone/typer.ts", to: "typer.ts" },
      { from: "typer/standalone/typer.css", to: "typer.css" },
      { to: "index.tsx", air: true },
    ],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  },
  {
    id: "arlan/color-depth",
    source: "arlan",
    title: "Color Depth",
    tags: ["button", "style", "skeuomorphic", "css"],
    when: "Ten layered-light materials (glossy, metal, glass, neon…) for buttons. Pure CSS classes; the SKILL.md ships as ref.",
    files: [
      { from: "color-depth/standalone/color-depth.css", to: "color-depth.css" },
      { from: "color-depth/standalone/color-depth.js", to: "color-depth.ts" },
      { from: "color-depth/standalone/SKILL.md", to: "SKILL.md" },
      { to: "index.tsx", air: true },
    ],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    kind: "style",
    patches: [
      { file: "color-depth.ts", find: "function initColorDepth(root = document) {", replace: "export function initColorDepth(root: ParentNode = document) {" },
      { file: "color-depth.ts", find: 'root.querySelectorAll(".depth-metal, .depth-foil")', replace: 'root.querySelectorAll<HTMLElement>(".depth-metal, .depth-foil")' },
      { file: "color-depth.ts", find: 'root.querySelectorAll(".depth-toggle")', replace: 'root.querySelectorAll<HTMLElement>(".depth-toggle")' },
      { file: "color-depth.ts", find: /\nif \(typeof document !== "undefined"\) \{[\s\S]*?\n\}\n?$/, replace: "\n" },
    ],
    notes: ["Upstream self-initialised on import; the Kit exports initColorDepth/useColorDepth instead."],
  },
  {
    id: "arlan/ghosty-reveal",
    source: "arlan",
    title: "Ghosty Reveal",
    tags: ["reveal", "mask", "motion", "media"],
    when: "Mask-image wipe that reveals or hides a block using an image mask you supply.",
    files: [{ from: "ghosty-reveal/standalone/GhostReveal.tsx", to: "index.tsx" }],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
  },
  {
    id: "arlan/holo",
    source: "arlan",
    title: "Holo Card",
    tags: ["card", "tilt", "motion", "3d", "pointer"],
    when: "Holographic foil card that tilts with the pointer or device orientation. One per screen; heavy blend modes.",
    files: [
      { from: "holo/HoloCard.tsx", to: "index.tsx" },
      { from: "holo/engine.ts", to: "engine.ts" },
      { to: "view-transition.ts", air: true },
    ],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    patches: [
      { file: "engine.ts", find: 'import { mediaUrl } from "../../lib/video-sources";\n', replace: "" },
      { file: "engine.ts", find: 'const TILE_PHOTO = "/holo/kamila.webp";\n', replace: "" },
      { file: "engine.ts", find: /export function applyFoil\(card: HTMLElement, foil: Foil\): void \{/, replace: "export function applyFoil(card: HTMLElement, foil: Foil, tileSrc?: string): void {" },
      { file: "engine.ts", find: '  s.setProperty("--tile-src", `url("${mediaUrl(TILE_PHOTO)}")`);', replace: '  if (tileSrc) s.setProperty("--tile-src", `url("${tileSrc}")`);\n  else s.removeProperty("--tile-src");' },
      { file: "index.tsx", find: 'import { onTransitionChange } from "../../lib/view-transition";', replace: 'import { onTransitionChange } from "./view-transition";' },
    ],
    notes: ["Upstream baked a site photo into the foil tile layer; the Kit takes `tileSrc` on applyFoil (unset → no tile)."],
  },
  {
    id: "arlan/liquid-ui",
    source: "arlan",
    title: "Liquid UI",
    tags: ["motion", "svg", "cards", "decor"],
    when: "SDF + marching-squares liquid silhouettes that merge cards. Decorative group backgrounds only.",
    files: [
      { from: "liquid/LiquidGroup.tsx", to: "index.tsx" },
      { from: "liquid/engine.ts", to: "engine.ts" },
      { from: "liquid/marching-squares.ts", to: "marching-squares.ts" },
      { from: "liquid/sdf.ts", to: "sdf.ts" },
    ],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    patches: [
      { file: "sdf.ts", find: "  eval(x: number, y: number): number {", replace: "  sample(x: number, y: number): number {" },
      { file: "marching-squares.ts", find: /\.eval\(/g, replace: ".sample(" },
    ],
    notes: ["The SDF field method `eval()` is renamed `sample()` so the CSP lint's eval rule stays a plain token match."],
  },
];

export const COMPONENTS: readonly ComponentSpec[] = [...FANCY, ...AICSS, ...BEAUTIFUL, ...LIBRARIES, ...ARLAN];

export function componentDir(spec: ComponentSpec): string {
  return spec.id;
}

export function shortName(spec: ComponentSpec): string {
  return spec.id.split("/")[1]!;
}
