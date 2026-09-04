/**
 * Kit sources (goal-create-v11 §12.1 / §21). Pins live here; `kit.sources.json`
 * is generated from this table plus the harvest outcome so the two never drift.
 */

export type SourceId = "fancy" | "aicss" | "beautiful" | "libraries" | "arlan";
export type Tier = "A" | "B";

export interface GithubPin {
  readonly kind: "github";
  readonly repo: string;
  readonly commit: string;
  /** Directory inside the repo that component paths are relative to. */
  readonly base: string;
}

export interface RegistryPin {
  readonly kind: "registry";
  readonly url: string;
  readonly captured: string;
}

export interface PagePin {
  readonly kind: "pages";
  readonly url: string;
  readonly captured: string;
}

export interface SourceSpec {
  readonly id: SourceId;
  readonly name: string;
  readonly homepage: string;
  readonly author: string;
  readonly spdx: string;
  readonly tier: Tier;
  readonly pin: GithubPin | RegistryPin | PagePin;
  /** Files under evidence/<id>/ that prove the license. */
  readonly licenseEvidence: readonly string[];
  /** Upstream paths (relative to pin.base / registry root) captured as license evidence. */
  readonly licenseFiles: readonly { readonly from: string; readonly to: string }[];
  readonly excluded: readonly { readonly name: string; readonly reason: string }[];
}

export const SOURCES: readonly SourceSpec[] = [
  {
    id: "fancy",
    name: "Fancy Components",
    homepage: "fancycomponents.dev",
    author: "daniel petho",
    spdx: "MIT",
    tier: "A",
    pin: {
      kind: "github",
      repo: "danielpetho/fancy",
      commit: "f9f62c61207b2dd3210476dd98af3c9a5be24094",
      base: "src/",
    },
    licenseEvidence: ["evidence/fancy/LICENSE"],
    licenseFiles: [{ from: "../LICENSE", to: "LICENSE" }],
    excluded: [
      { name: "text/variable-font-*", reason: "needs variable web fonts the mini origin does not self-host (CR12 font-src 'self')" },
      { name: "text/text-cursor-proximity, blocks/drag-elements", reason: "pointer-hover interactions with no touch equivalent" },
      { name: "physics/gravity, physics/cursor-attractor-and-gravity", reason: "matter-js is not in the vendor snapshot; physics is non-lite only" },
      { name: "image/*, carousel/*, background/* except the two harvested", reason: "WebGL or heavy image pipelines outside the webview profile" },
    ],
  },
  {
    id: "aicss",
    name: "AI CSS (free tier)",
    homepage: "aicss.dev",
    author: "Kevin Kelder (kvnkld)",
    spdx: "MIT",
    tier: "A",
    pin: {
      kind: "github",
      repo: "kvnkld/aicss",
      commit: "4556a918fd8c9358d42d2b24a3866301b8ea10a2",
      base: "packages/react/src/",
    },
    licenseEvidence: ["evidence/aicss/LICENSE", "evidence/aicss/license-page.md"],
    licenseFiles: [{ from: "../../../LICENSE", to: "LICENSE" }],
    excluded: [
      { name: "file-diff, image-generation, inline-citations, comparison-table", reason: "Pro components; private source, paid license (aicss.dev/license)" },
    ],
  },
  {
    id: "beautiful",
    name: "Beautiful UI",
    homepage: "beautifului.dev",
    author: "Shane Levine",
    spdx: "MIT",
    tier: "A",
    pin: {
      kind: "registry",
      url: "https://beautifului.dev/r/",
      captured: "2026-09-04",
    },
    licenseEvidence: ["evidence/beautiful/license-page.md"],
    licenseFiles: [],
    excluded: [
      { name: "prompt-bar", reason: "depends on glimm (WebGL)" },
      { name: "sidebar-nav", reason: "depends on @central-icons-react (proprietary icon set)" },
      { name: "insight-cards", reason: "depends on liveline (chart runtime; over the lite budget)" },
      { name: "agent-screen", reason: "GAP — registry lists it but /r/agent-screen.json returns 404; not fabricated" },
    ],
  },
  {
    id: "libraries",
    name: "libraries.dev",
    homepage: "libraries.dev",
    author: "Jakub Antalik",
    spdx: "MIT",
    tier: "A",
    pin: {
      kind: "github",
      repo: "Jakubantalik/Libraries.dev",
      commit: "aea4c00db4b7ad634cbf43357afa80cdf050b68d",
      base: "packages/",
    },
    licenseEvidence: [
      "evidence/libraries/thinking-orbs.LICENSE",
      "evidence/libraries/border-beam.LICENSE",
      "evidence/libraries/liquid-gooey.LICENSE",
      "evidence/libraries/metal-fx.LICENSE",
      "evidence/libraries/metal-fx.NOTICE",
    ],
    licenseFiles: [
      { from: "thinking-orbs/LICENSE", to: "thinking-orbs.LICENSE" },
      { from: "border-beam/LICENSE", to: "border-beam.LICENSE" },
      { from: "liquid-gooey/LICENSE", to: "liquid-gooey.LICENSE" },
      { from: "metal-fx/LICENSE", to: "metal-fx.LICENSE" },
      { from: "metal-fx/NOTICE", to: "metal-fx.NOTICE" },
    ],
    excluded: [
      { name: "img-fx", reason: "image pipeline over the lite budget" },
      { name: "metal-fx (lite)", reason: "WebGL shader; harvested as non-lite only, NOTICE preserved" },
    ],
  },
  {
    id: "arlan",
    name: "arlan.me vault",
    homepage: "arlan.me/vault",
    author: "Arlan Marat",
    spdx: "MIT",
    tier: "A",
    pin: {
      kind: "pages",
      url: "https://arlan.me/vault/",
      captured: "2026-09-04",
    },
    licenseEvidence: ["evidence/arlan/license-page.md", "evidence/arlan/vault-index.md"],
    licenseFiles: [],
    excluded: [
      { name: "amo, midjourney, figma, dia-gradient", reason: "recreations of third-party trade dress" },
      { name: "arcade-pixel, fade-motion, chroma-glow, emboss", reason: "WebGL" },
      { name: "ransom-note", reason: "GAP — component is a manifest of site-hosted cut-out letter images (/vault/ransom/manifest.json) we did not capture; shipping it would redistribute unlicensed imagery" },
    ],
  },
];

export function source(id: SourceId): SourceSpec {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown source ${id}`);
  return s;
}

/** Short provenance string recorded in meta.json `license.source`. */
export function provenance(spec: SourceSpec): string {
  const pin = spec.pin;
  if (pin.kind === "github") return `${pin.repo}@${pin.commit.slice(0, 12)}`;
  return `${spec.homepage}@${pin.captured}`;
}
