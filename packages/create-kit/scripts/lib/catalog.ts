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
    "\nfunction debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number, options?: { leading?: boolean; trailing?: boolean }) {\n" +
    "  const { leading = false, trailing = true } = options ?? {}\n" +
    "  let t: ReturnType<typeof setTimeout> | undefined\n" +
    "  let firedLeading = false\n" +
    "  return (...args: A) => {\n" +
    "    const burstStart = t === undefined\n" +
    "    if (t) clearTimeout(t)\n" +
    "    if (leading && burstStart) {\n      firedLeading = true\n      fn(...args)\n    } else {\n      firedLeading = false\n    }\n" +
    "    t = setTimeout(() => {\n      t = undefined\n      if (trailing && !firedLeading) fn(...args)\n      firedLeading = false\n    }, wait)\n  }\n}\n",
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
    tags: ["shape", "button", "card", "style"],
    when: "Apple's corner: the curve eases into the flat edge with no kink, so a button or card reads smooth all the way round. Pick it for the one CTA or hero card whose outline matters; rows and chips keep the Air pill radius.",
    files: [
      { from: "squircle/Squircle.tsx", to: "index.tsx" },
      { from: "squircle/superellipse.ts", to: "superellipse.ts" },
      { from: "squircle/tokens.ts", to: "tokens.ts" },
    ],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "n/a",
    notes: ["Paints a shaped fill or stroke behind the content; it does not clip children. No fill and no stroke means nothing is drawn.", "Children are overlaid absolutely, so the box has no intrinsic size; give it a width and at least 2.75rem of height or it collapses to 0.", "It is a div: wrap it in a <button> (position relative, padding 0) so the whole shape is the 44px tap target.", "Fill and stroke take any CSS colour: pass Air tokens (var(--panel-bg), var(--ring)); a gradient fill switches to a clip-path layer.", "radius is clamped to half the short side and scaled by smoothing (0-1); on a 44px button radius 22 is a full pill, so use 14-18.", "compare=true draws an ordinary rounded rect (the vault's A/B toggle); never ship it in an app."],
  },
  {
    id: "arlan/typer",
    source: "arlan",
    title: "Typer",
    tags: ["text", "motion", "hero", "status"],
    when: "A headline that types in instead of fading: a wave runs along the line and each letter flickers through pill, highlight and outline, then lands as text. Pick it over fancy/typewriter when the line must also type away.",
    files: [
      { from: "typer/standalone/typer.ts", to: "typer.ts" },
      { from: "typer/standalone/typer.css", to: "typer.css" },
      { to: "index.tsx", air: true },
    ],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    notes: ["Pill colours are literals; set the four --typer-* variables to --ink, --canvas, --accent and --on-accent or the pills fight the dark canvas.", "Hidden (opacity 0) until its first frame; keep `delay` (seconds) near 0 or the compact card opens with a blank headline.", "Words are white-space: pre and wrap only between words; keep one short line at 390px or the bar breaks mid-wave.", "Merged bars need :has(); older WebKit shows separate pills, which still reads. Pass plain strings only; destroy restores innerHTML.", "One short line per screen; a paragraph of flickering pills is noise. `out` leaves the slot empty, so the next text must land at once.", "Runs at 20 fps on a finite timer and stops; there is no loop to hide, but two typers at once break the one-hero-motion rule."],
  },
  {
    id: "arlan/color-depth",
    source: "arlan",
    title: "Color Depth",
    tags: ["button", "style", "material", "action"],
    when: "Buttons that feel like real objects: glossy plastic, brushed metal, glass, a soft cushion, neon, a pressed-in key. Pick one material per screen for the primary action; glass needs backdrop-filter, so never under lite.",
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
    notes: ["Upstream self-initialised on import; the Kit exports initColorDepth/useColorDepth instead.", "depth-glass needs backdrop-filter (banned under lite) and an SVG #liquid-glass-filter the Kit does not ship; use depth-layered or satin.", "depth-foil needs its child layer spans, loops two drifts with screen blends and stops only on reduced motion: one CTA, the hero motion.", "Metal and foil glints follow the pointer; on touch they move only while the finger is down, so the resting face must read as the material.", "Only layered, inset, duotone and satin have :active press states; add press feedback to the others or taps feel dead on touch.", "Colours and the font are literals (#fff label, cyan --neon, system sans); override per material with Air tokens or they fight the theme.", "Keep one light direction (top) and at most two materials per screen; neighbouring controls that disagree about the light break the illusion."],
  },
  {
    id: "arlan/ghosty-reveal",
    source: "arlan",
    title: "Ghosty Reveal",
    tags: ["reveal", "media", "motion", "hero", "gallery"],
    when: "A photo bleeds in through a soft, cloudy edge, as if forming out of fog. Pick it for the one hero image or a confirmation reveal; the owner bundles the cloud mask, and text takes fancy/vertical-cut-reveal.",
    files: [{ from: "ghosty-reveal/standalone/GhostReveal.tsx", to: "index.tsx" }],
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    notes: ["maskSrc is a soft-gradient PNG or SVG bundled in the app; a missing or remote mask resolves transparent, so the block never appears.", "left/right need maskSrcH (a horizontal mask); without it the vertical mask is stretched sideways and the fog edge runs the wrong way.", "Uncontrolled it fires once at 20% visibility, on mount in the compact card. Below the fold, drive play from state (the confirm tap) instead.", "The mask is composited at 500% of the block; keep it to one full-width photo per screen, not a list of thumbnails.", "Under reduced motion the wipe is a 0.3s opacity fade and onHidden never fires (it listens for mask-position); do not gate logic on it."],
  },
  {
    id: "arlan/holo",
    source: "arlan",
    title: "Holo Card",
    tags: ["card", "motion", "hero", "material"],
    when: "An ID card on holographic foil: tilt it or turn the phone and the foil catches the light, marks rise on the turned side and the photo flips colour. Pick it for one membership, ticket or pass card, the screen's hero.",
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
    notes: ["Upstream baked a site photo into the foil tile layer; the Kit takes `tileSrc` on applyFoil (unset → no tile).", "No .holo-* layer stylesheet was harvested; the engine only writes CSS variables, so today the card paints as a flat plate.", "HoloCard and HoloBody hard-code the vault's 'Kamila' copy and aria-label with no props to change them; rewrite both before shipping.", "deviceorientation is listened to without the iOS permission request, so phone tilt may never arrive; drag and idle drift must carry it.", "Finger tilt is pointermove on the host and competes with page scroll; unless the card is the whole compact screen, rely on the idle drift.", "Under reduced motion the loop never starts, so applyFrame never writes the tilt variables; paint one resting frame at mount.", "The host plate is a literal light gradient plus --border-line, which Air does not define; restyle it with var(--panel-bg) and var(--ring)."],
  },
  {
    id: "arlan/liquid-ui",
    source: "arlan",
    title: "Liquid UI",
    tags: ["motion", "card", "layout", "decor"],
    when: "Two cards fuse and the corner between them bends inward, as if poured together; one knob runs from crisp joints to gooey blobs. Pick it for a 2-4 card cluster read as one poured shape; menus take libraries/liquid-gooey.",
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
    notes: ["The SDF field method `eval()` is renamed `sample()` so the CSP lint's eval rule stays a plain token match.", "Default fill var(--bg-hover) is undefined in Air, so the skin falls back to black; always pass fill=\"var(--panel-bg)\" or \"var(--well-bg)\".", "Cards are absolute pixels and the group has no height; lay out for a 358px column and set the wrapper height or it collapses to 0.", "The skin recomputes per render, not per frame: move cards between settled layouts (<= 300ms), never on pointer drag like the vault demo.", "Cards must stay transparent (no .panel background) or they cover the poured skin; the fill lives on the group, the text in the cards.", "Bridges are for cards that do not touch; adjacent cards fuse from k alone. cell below 4 multiplies the main-thread marching cost at mount.", "Text and controls are real DOM above the aria-hidden skin, so keep 44px targets inside each LiquidCard."],
  },
  {
    id: "arlan/shutter-type",
    source: "arlan",
    title: "Shutter Type",
    tags: ["text", "motion", "hero", "canvas"],
    when: "Two lines of type seen through a rolling shutter: stripes lag the ink so a word tears into bands only while it moves and is whole at rest. One hero motion for a title card; the phrases are props.",
    files: [
      { from: "shutter-type/ShutterTypeCard.tsx", to: "index.tsx" },
      { from: "shutter-type/engine.ts", to: "engine.ts" },
      { from: "shutter-type/params.ts", to: "params.ts" },
      { to: "view-transition.ts", air: true },
    ],
    demoExport: "ShutterTypeCard",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    patches: [
      { file: "index.tsx", find: 'import { onTransitionChange } from "../../lib/view-transition";', replace: 'import { onTransitionChange } from "./view-transition";' },
      { file: "params.ts", find: 'export const FONT_VAR = "--font-neue-montreal";', replace: 'export const FONT_VAR = "--font-body";' },
    ],
    notes: [
      "Upstream set the type in Neue Montreal; the Kit reads `--font-body`, re-measuring the ink boxes when the webfont arrives so the composition holds still.",
      "PAPER/SKY are the piece's own colours (warm paper, sky blue) and stay literal by design; the card's frame follows the shell tokens.",
    ],
  },
  {
    id: "arlan/swing-type",
    source: "arlan",
    title: "Swing Type",
    tags: ["text", "motion", "hero", "canvas"],
    when: "Enormous coloured letters on a pendulum, each turning edge-on as it passes so only two or three read at once and the word never assembles; the word changes by turning. A hero for a title screen, never body copy.",
    files: [
      { from: "swing-type/SwingTypeCard.tsx", to: "index.tsx" },
      { from: "swing-type/engine.ts", to: "engine.ts" },
      { from: "swing-type/params.ts", to: "params.ts" },
      { to: "view-transition.ts", air: true },
    ],
    demoExport: "SwingTypeCard",
    deps: [],
    litePolicy: "auto",
    touch: true,
    reducedMotion: "static",
    patches: [
      { file: "index.tsx", find: 'import { onTransitionChange } from "../../lib/view-transition";', replace: 'import { onTransitionChange } from "./view-transition";' },
      { file: "params.ts", find: 'export const FONT_VAR = "--font-neue-montreal";', replace: 'export const FONT_VAR = "--font-body";' },
    ],
    notes: [
      "Every word in WORDS must have the same letter count: the swing amplitude is derived from it and a shorter word swings out of frame.",
      "The five INK colours are tuned for a white field at equal chroma and lightness; on the dark atmosphere canvas set BG/INK together or keep the card on its own light plate.",
    ],
  },
  {
    id: "arlan/rush-type",
    source: "arlan",
    title: "Rush Type",
    tags: ["text", "motion", "hero", "webgl"],
    when: "One lowercase word rests, then blasts twelve times taller and tears into green and violet streaks from speed alone, resolving to plain white at rest; the next word falls out of the blur. Non-lite: WebGL1.",
    files: [
      { from: "rush-type/RushTypeCard.tsx", to: "index.tsx" },
      { from: "rush-type/engine.ts", to: "engine.ts" },
      { from: "rush-type/params.ts", to: "params.ts" },
      { to: "view-transition.ts", air: true },
    ],
    demoExport: "RushTypeCard",
    deps: [],
    litePolicy: "never",
    litePolicyReason: "WebGL1 fragment shader; lite surfaces draw the resting word as a still",
    touch: true,
    reducedMotion: "static",
    patches: [
      { file: "index.tsx", find: 'import { onTransitionChange } from "../../lib/view-transition";', replace: 'import { onTransitionChange } from "./view-transition";' },
      { file: "params.ts", find: 'export const FONT_VAR = "var(--font-neue-montreal)";', replace: 'export const FONT_VAR = "var(--font-body)";' },
    ],
    notes: [
      "Pointing at the card holds the word at its peak (pointer events, no preventDefault); inside a Messages webview the scroll coupling is inert.",
      "Under lite, reduced motion or no WebGL the engine draws one crisp still of the resting word — never a mid-blast frame.",
      "Keep WORDS short and the count even: a word lives in an atlas half by index parity.",
    ],
  },
];

export const COMPONENTS: readonly ComponentSpec[] = [...FANCY, ...AICSS, ...BEAUTIFUL, ...LIBRARIES, ...ARLAN];

export function componentDir(spec: ComponentSpec): string {
  return spec.id;
}

export function shortName(spec: ComponentSpec): string {
  return spec.id.split("/")[1]!;
}
