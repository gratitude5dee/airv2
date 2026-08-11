/**
 * CM5 conformance: an ad platform wants an *asset group*, not a picture.
 * Conformance is reported per asset (task 5) — `spec_conformance[]` on every
 * asset names which spec slots it satisfies, the matrix shows asset ×
 * placement-slot, and the gaps are the work. Copy is linted against the
 * brand's constraints (task 4) before it can enter the group.
 */
import { lintCopy } from "../brand/compile";
import type { BrandSource, CopyViolation } from "../brand/types";
import type { CreativeSpec, SpecText } from "../publish/specs/ads";

export interface AdGroupText {
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  finalUrl: string | null;
}

export interface AdGroupAsset {
  id: string;
  kind: string;
  w: number | null;
  h: number | null;
  duration: number | null;
  role: "image" | "video" | "logo";
}

export interface TextProblem {
  field: "headlines" | "longHeadlines" | "descriptions";
  index: number;
  message: string;
}

export interface CopyProblem {
  field: string;
  index: number;
  violation: CopyViolation;
}

export interface ConformanceReport {
  /** asset id → spec slots it satisfies, e.g. "images/1:1". */
  assets: Record<string, string[]>;
  /** Spec slots no asset satisfies — the gaps are the work. */
  gaps: string[];
  textProblems: TextProblem[];
  copyProblems: CopyProblem[];
  complete: boolean;
}

const RATIO_TOLERANCE = 0.02;

function parseRatio(ratio: string): number | null {
  const [w, h] = ratio.split(":");
  const rw = Number(w);
  const rh = Number(h);
  if (!Number.isFinite(rw) || !Number.isFinite(rh) || rh === 0) return null;
  return rw / rh;
}

function matchesRatio(asset: AdGroupAsset, ratio: string): boolean {
  if (!asset.w || !asset.h) return false;
  const target = parseRatio(ratio);
  if (target === null) return false;
  return Math.abs(asset.w / asset.h - target) / target <= RATIO_TOLERANCE;
}

function matchesSize(asset: AdGroupAsset, size: string): boolean {
  const [w, h] = size.split("x").map(Number);
  return asset.w === w && asset.h === h;
}

function assetSlots(asset: AdGroupAsset, spec: CreativeSpec): string[] {
  const slots: string[] = [];
  if (asset.role === "image" && spec.images) {
    for (const ratio of spec.images.ratios ?? []) {
      if (matchesRatio(asset, ratio)) slots.push(`images/${ratio}`);
    }
    for (const size of spec.images.sizes ?? []) {
      if (matchesSize(asset, size)) slots.push(`images/${size}`);
    }
  }
  if (asset.role === "logo" && spec.logos) {
    for (const ratio of spec.logos.ratios ?? []) {
      if (matchesRatio(asset, ratio)) slots.push(`logos/${ratio}`);
    }
  }
  if (asset.role === "video" && spec.videos) {
    const { minSeconds, maxSeconds } = spec.videos;
    const duration = asset.duration ?? 0;
    const durationOk =
      (minSeconds === undefined || duration >= minSeconds) &&
      (maxSeconds === undefined || duration <= maxSeconds);
    if (durationOk) {
      for (const orientation of spec.videos.orientations ?? []) {
        if (matchesRatio(asset, orientation)) {
          slots.push(`videos/${orientation}`);
        }
      }
    }
  }
  return slots;
}

function requiredSlots(spec: CreativeSpec): string[] {
  const slots: string[] = [];
  for (const ratio of spec.images?.ratios ?? []) slots.push(`images/${ratio}`);
  for (const size of spec.images?.sizes ?? []) slots.push(`images/${size}`);
  for (const ratio of spec.logos?.ratios ?? []) slots.push(`logos/${ratio}`);
  for (const orientation of spec.videos?.orientations ?? []) {
    slots.push(`videos/${orientation}`);
  }
  return slots;
}

function checkText(
  field: TextProblem["field"],
  values: string[],
  rule: SpecText | undefined,
  problems: TextProblem[]
): void {
  if (!rule) return;
  if (values.length > rule.max) {
    problems.push({
      field,
      index: -1,
      message: `${field}: ${values.length} provided, spec allows ${rule.max}`,
    });
  }
  values.forEach((value, index) => {
    if (value.length > rule.maxChars) {
      problems.push({
        field,
        index,
        message: `${field}[${index}] is ${value.length} chars, limit ${rule.maxChars}`,
      });
    }
  });
}

export function groupConformance(
  spec: CreativeSpec,
  text: AdGroupText,
  assets: AdGroupAsset[],
  brand: BrandSource | null
): ConformanceReport {
  const perAsset: Record<string, string[]> = {};
  const satisfied = new Set<string>();
  for (const asset of assets) {
    const slots = assetSlots(asset, spec);
    perAsset[asset.id] = slots;
    for (const slot of slots) satisfied.add(slot);
  }
  const gaps = requiredSlots(spec).filter((slot) => !satisfied.has(slot));

  const textProblems: TextProblem[] = [];
  checkText("headlines", text.headlines, spec.text?.headlines, textProblems);
  checkText(
    "longHeadlines",
    text.longHeadlines,
    spec.text?.longHeadlines,
    textProblems
  );
  checkText(
    "descriptions",
    text.descriptions,
    spec.text?.descriptions,
    textProblems
  );

  const copyProblems: CopyProblem[] = [];
  if (brand) {
    const lanes: Array<[string, string[]]> = [
      ["headlines", text.headlines],
      ["longHeadlines", text.longHeadlines],
      ["descriptions", text.descriptions],
    ];
    for (const [field, values] of lanes) {
      values.forEach((value, index) => {
        for (const violation of lintCopy(value, brand)) {
          copyProblems.push({ field, index, violation });
        }
      });
    }
  }

  return {
    assets: perAsset,
    gaps,
    textProblems,
    copyProblems,
    complete:
      gaps.length === 0 &&
      textProblems.length === 0 &&
      copyProblems.length === 0,
  };
}
