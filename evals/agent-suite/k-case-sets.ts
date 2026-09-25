/**
 * K-case provenance metadata (R-EV-09). Two labels per K-case:
 *
 *   holdout    — every case whose numeric id divides by 3 (K105, K108, …,
 *                32 of 96). These are held out of all prompt and
 *                route-description tuning so the model-tier run has an
 *                untouched third to measure against.
 *   in_sample  — the case's message shares ≥2 distinctive tokens with its
 *                expected_skill's ROUTE_OPTIONS description in
 *                apps/web/lib/jev/questions.ts. The Jev route text already
 *                encodes K-case language, so these scores are labelled
 *                in-sample rather than treated as generalization.
 *
 * Regenerate after touching messages.jsonl or ROUTE_OPTIONS:
 *
 *   npx tsx evals/agent-suite/k-case-sets.ts
 *
 * The model-tier run this labels is DEFERRED — it needs a funded control
 * plane and a live box after R-EV-01…06 land.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadCases, type EvalCase } from "./lib";
import { ROUTE_OPTIONS } from "../../apps/web/lib/jev/questions";

const HERE = new URL(".", import.meta.url).pathname;
const OUT = join(HERE, "k-case-sets.json");

const STOPWORDS = new Set(
  "this,that,with,from,your,their,they,them,have,been,will,would,could,should,into,onto,when,what,where,which,about,before,after,owner,turn,than,then,over,under,also,even,just,like,make,made,much,some,such,only,more,most,other,each,every,next,last,back,here,there,does,doing,done,help,need,want,tell,know,find,show,give,take,gets,get,put,set,say,said,send,check,look,work,thing,things,going,goes,still,really,right,okay,please,thanks,hello,yeah"
    .split(",")
);

export const HOLDOUT_MODULUS = 3;
export const IN_SAMPLE_MIN_SHARED = 2;

function tokens(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(
      (token) => !STOPWORDS.has(token)
    )
  );
}

export interface KCaseLabel {
  expected_skill: string;
  holdout: boolean;
  in_sample: boolean;
  /** The shared tokens that earned the in_sample label — audit trail. */
  shared: string[];
}

export interface KCaseSets {
  spec: string;
  run: string;
  holdout_rule: string;
  in_sample_rule: string;
  cases: Record<string, KCaseLabel>;
  totals: { cases: number; holdout: number; in_sample: number };
}

export function computeKCaseSets(
  cases: EvalCase[],
  routes: Record<string, string> = ROUTE_OPTIONS
): KCaseSets {
  const kCases = cases
    .filter((kase) => /^K\d+$/.test(kase.id))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const labelled: Record<string, KCaseLabel> = {};
  let holdout = 0;
  let inSample = 0;
  for (const kase of kCases) {
    const isHoldout =
      Number(kase.id.slice(1)) % HOLDOUT_MODULUS === 0;
    const description = routes[kase.expected_skill];
    const messageTokens = tokens(kase.message);
    const shared = description
      ? [...tokens(description)].filter((token) => messageTokens.has(token)).sort()
      : [];
    const isInSample = shared.length >= IN_SAMPLE_MIN_SHARED;
    if (isHoldout) holdout += 1;
    if (isInSample) inSample += 1;
    labelled[kase.id] = {
      expected_skill: kase.expected_skill,
      holdout: isHoldout,
      in_sample: isInSample,
      shared,
    };
  }
  return {
    spec: "R-EV-09",
    run: "deferred — model-tier run needs a funded control plane and a live box after R-EV-01…06 land",
    holdout_rule: `numeric case id % ${HOLDOUT_MODULUS} === 0 — held out of all prompt and route-description tuning`,
    in_sample_rule: `≥${IN_SAMPLE_MIN_SHARED} distinctive tokens shared between the case message and its expected_skill's ROUTE_OPTIONS description (len≥4 alpha, stopwords removed)`,
    cases: labelled,
    totals: {
      cases: kCases.length,
      holdout,
      in_sample: inSample,
    },
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const sets = computeKCaseSets(loadCases(join(HERE, "messages.jsonl")));
  writeFileSync(OUT, `${JSON.stringify(sets, null, 2)}\n`);
  console.log(
    `wrote ${OUT}: ${sets.totals.cases} K-cases, ` +
      `${sets.totals.holdout} held out, ${sets.totals.in_sample} in-sample`
  );
}
