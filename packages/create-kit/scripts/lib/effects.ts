/**
 * Effects vocabulary (goal-create-v12 §11.3): DESIGN.md §4 is rendered from
 * prompts/src/effects.json (curated data, one entry per catalogued effect)
 * and prompts/src/effects.md (the intro prose). One line per effect, with a
 * grammar that depends on the verb, so a Planner resolves a named look in one
 * lookup. Pure function of (data, prose, metas) so `harvest --docs-only`
 * reproduces it byte for byte and `verify.ts` catches a hand edit.
 */
import path from "node:path";
import type { Meta } from "./meta.ts";
import { PROMPTS_SRC } from "./paths.ts";
import { readJson, readText } from "./fsx.ts";

export type Disposition =
  | "kit-a-equivalent"
  | "tier-b-packed"
  | "tier-b-pack-candidate"
  | "build-original"
  | "not-for-miniapp";

export type DeclineRule =
  | "pointer-only"
  | "scroll-linked"
  | "excluded-study"
  | "remote-asset"
  | "no-phone-use"
  | "trade-dress"
  | "heavy"
  | "n/a";

export interface EffectEntry {
  readonly key: string;
  readonly name: string;
  readonly source: string;
  readonly category: string;
  readonly disposition: Disposition;
  readonly kit_equivalent: string;
  readonly when: string;
  readonly tags: readonly string[];
  readonly recipe_fit: readonly string[];
  readonly template_fit: readonly string[];
  readonly renderer: string;
  readonly lite: boolean;
  readonly touch: boolean;
  readonly reduced_motion: string;
  readonly brief?: string;
  readonly build_renderer?: string;
  readonly build_lite?: boolean;
  readonly build_touch?: boolean;
  readonly fallback?: string;
  readonly rule?: DeclineRule;
  readonly nearest?: string;
}

export interface EffectsData {
  readonly $schema: string;
  readonly captured: string;
  readonly entries: readonly EffectEntry[];
}

export const EFFECTS_DATA = path.join(PROMPTS_SRC, "effects.json");
export const EFFECTS_INTRO = path.join(PROMPTS_SRC, "effects.md");

const GROUPS: readonly { readonly title: string; readonly match: (e: EffectEntry) => boolean }[] = [
  { title: "Text", match: (e) => e.category === "Text Animations" },
  { title: "Motion, pointer and tap feedback", match: (e) => e.category === "Animations" },
  { title: "Cards, lists, galleries, navigation", match: (e) => e.category === "Components" },
  { title: "Backgrounds and fields", match: (e) => e.category === "Backgrounds" },
  { title: "arlan.me vault studies", match: (e) => e.source.startsWith("Arlan Vault") },
];

const VERB_ORDER: Record<Disposition, number> = {
  "kit-a-equivalent": 0,
  "tier-b-packed": 1,
  "tier-b-pack-candidate": 2,
  "build-original": 3,
  "not-for-miniapp": 4,
};

const RULE_TEXT: Record<Exclude<DeclineRule, "n/a">, string> = {
  "pointer-only": "pointer-driven with no tap equivalent (no pointer on touch)",
  "scroll-linked": "moves on scroll (nothing moves on scroll inside the webview)",
  "excluded-study": "§5 excludes the study (WebGL post-effect with no lite frame)",
  "remote-asset": "needs a remote asset the CSP forbids",
  "no-phone-use": "no phone-sized use inside Messages",
  "trade-dress": "reproduces a third party's trade dress (§5)",
  heavy: "a physics or 3D playground far over the budgets",
};

const tick = (b: boolean): string => (b ? "✓" : "✗");

function sentence(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function fits(e: EffectEntry): string {
  const all = [...new Set([...e.recipe_fit, ...e.template_fit])];
  return all.length ? ` Fits: ${all.join(", ")}.` : "";
}

function tags(e: EffectEntry): string {
  return e.tags.length ? ` Tags: ${e.tags.slice(0, 5).join(", ")}.` : "";
}

function kitFlags(id: string, metas: ReadonlyMap<string, Meta>): string {
  const m = metas.get(id);
  if (!m) return "";
  return ` · lite ${tick(m.lite)} · touch ${tick(m.touch)} · motion ${m.reducedMotion}`;
}

export function renderLine(e: EffectEntry, metas: ReadonlyMap<string, Meta>): string {
  const name = `- **${e.name}**`;
  switch (e.disposition) {
    case "kit-a-equivalent": {
      const id = e.kit_equivalent.replace(/^@kit\//, "");
      return `${name} · \`@kit/${id}\`${kitFlags(id, metas)} — ${sentence(e.when)}${tags(e)}${fits(e)}`;
    }
    case "tier-b-packed":
      return `${name} · \`@kit/restricted/${e.key}\` · ${e.renderer} · lite ✗ — ${sentence(e.when)} Non-lite; you supply the still frame under reduced motion.${tags(e)}${fits(e)}`;
    case "tier-b-pack-candidate": {
      const until = e.fallback ? `use \`@kit/restricted/${e.fallback}\`` : "decline; no packed substitute";
      return `${name} · \`pack\` · ${e.renderer} · lite ✗ — ${sentence(e.when)} Until packed: ${until}.${tags(e)}${fits(e)}`;
    }
    case "build-original": {
      const renderer = e.build_renderer && e.build_renderer !== "n/a" ? e.build_renderer : e.renderer;
      const lite = e.build_lite ?? e.lite;
      const touch = e.build_touch ?? e.touch;
      const brief = e.brief ? ` Build: ${sentence(e.brief)}` : "";
      return `${name} · \`build\` · ${renderer} · lite ${tick(lite)} · touch ${tick(touch)} · motion ${e.reduced_motion} — ${sentence(e.when)}${brief}${tags(e)}${fits(e)}`;
    }
    case "not-for-miniapp": {
      const rule = e.rule && e.rule !== "n/a" ? RULE_TEXT[e.rule] : "outside the mini-app contract";
      const instead = e.nearest ? `\`@kit/${e.nearest.replace(/^@kit\//, "")}\`` : "none";
      return `${name} · \`no\` — ${sentence(e.when).replace(/\.$/, "")}; \`no\`: ${rule}. Instead: ${instead}.`;
    }
  }
}

function groupSummary(rows: readonly EffectEntry[]): string {
  const n = (d: Disposition) => rows.filter((e) => e.disposition === d).length;
  return `${rows.length} effects: ${n("kit-a-equivalent")} already in the Kit, ${n("tier-b-packed")} packed Tier B, ${n("tier-b-pack-candidate")} to pack, ${n("build-original")} to build, ${n("not-for-miniapp")} not for a mini-app.`;
}

export function loadEffects(): EffectsData {
  return readJson<EffectsData>(EFFECTS_DATA);
}

/** DESIGN.md §4: the intro prose followed by the rendered groups. */
export function renderEffects(metas: readonly Meta[]): string {
  const data = loadEffects();
  const byId = new Map(metas.map((m) => [m.id, m] as const));
  const intro = readText(EFFECTS_INTRO).trim().replace(/\{\{count\}\}/g, String(data.entries.length)).replace(/\{\{captured\}\}/g, data.captured);
  const seen = new Set<string>();
  const sections: string[] = [];
  for (const g of GROUPS) {
    const rows = data.entries
      .filter((e) => !seen.has(e.key) && g.match(e))
      .sort((a, b) => VERB_ORDER[a.disposition] - VERB_ORDER[b.disposition] || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    if (rows.length === 0) continue;
    for (const r of rows) seen.add(r.key);
    sections.push(`### ${g.title}\n\n${groupSummary(rows)}\n\n${rows.map((e) => renderLine(e, byId)).join("\n")}`);
  }
  const orphans = data.entries.filter((e) => !seen.has(e.key));
  if (orphans.length) throw new Error(`effects.json: ${orphans.length} entries match no group (${orphans.map((e) => e.key).join(", ")})`);
  return `${intro}\n\n${sections.join("\n\n")}`;
}
