/** Shapes of the generated artifacts: meta.json, kit.lock.json, kit.sources.json. */
import type { ReducedMotion, Kind } from "./catalog.ts";
import type { SourceId, Tier } from "./sources.ts";

export const KIT_VERSION = "2026.09";

export interface Meta {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly when: string;
  readonly kind: Kind;
  readonly entry: string;
  readonly props: Readonly<Record<string, string>>;
  readonly deps: readonly string[];
  readonly weightKb: { readonly js: number; readonly css: number; readonly jsFull: number };
  readonly lite: boolean;
  readonly liteReason: string | null;
  readonly touch: boolean;
  readonly reducedMotion: ReducedMotion;
  readonly author: string;
  readonly license: { readonly spdx: string; readonly tier: Tier; readonly source: string };
  readonly csp: { readonly ok: boolean; readonly findings: readonly string[] };
  readonly harness: {
    readonly viewport: "390x760";
    readonly webgl: false;
    readonly reducedMotion: true;
    readonly ok: boolean;
    readonly heightPx: number;
    readonly errors: readonly string[];
  };
  readonly notes: readonly string[];
}

/** One entry per file under kit/, same key set as skills-lock.json entries plus provenance. */
export interface LockEntry {
  readonly source: string;
  readonly sourceType: "github" | "registry" | "pages" | "air";
  readonly skillPath: string | null;
  readonly computedHash: string;
  readonly upstreamHash: string | null;
  readonly component: string;
  readonly spdx: string;
  readonly tier: Tier;
}

export interface Lock {
  readonly version: 1;
  readonly kit: {
    readonly version: string;
    readonly components: number;
    readonly liteJsKb: number;
    readonly liteCssKb: number;
    readonly budgets: { readonly liteJsKb: number; readonly cssKb: number; readonly hardJsKb: number; readonly imageKb: number };
  };
  readonly files: Readonly<Record<string, LockEntry>>;
}

export interface SourcesJsonEntry {
  readonly id: SourceId;
  readonly name: string;
  readonly homepage: string;
  readonly author: string;
  readonly spdx: string;
  readonly tier: Tier;
  readonly pin: unknown;
  readonly licenseEvidence: readonly string[];
  readonly harvested: readonly string[];
  readonly excluded: readonly { readonly name: string; readonly reason: string }[];
  readonly gaps: readonly { readonly name: string; readonly reason: string }[];
}

export const BUDGETS = { liteJsKb: 300, cssKb: 200, hardJsKb: 1024, imageKb: 2048 } as const;
