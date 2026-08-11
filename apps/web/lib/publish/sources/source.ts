/**
 * CM7: a persona is a source of moments plus a template of what to make —
 * nothing below the calendar changes. A CalendarSource turns external state
 * (a store catalog, a tour itinerary) into Moments, and a Moment into a
 * sequence of briefed steps that land as *proposed* slots. Adding a source
 * adds a file here (CM7 task 3); if it needs a change anywhere else in
 * lib/publish/, the abstraction is wrong.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandSource } from "@/lib/brand/types";

export interface DateRange {
  start: Date;
  end: Date;
}

/** A reason to make something, anchored to an instant. `key` is the dedupe
 * identity: the same launch proposed twice must produce the same key. */
export interface Moment {
  /** Stable within (user, source): e.g. `launch:gid://shopify/Product/1`. */
  key: string;
  kind: string;
  label: string;
  occursAt: Date;
  timezone: string;
  /** Structured facts the briefs interpolate (product title, venue, city…). */
  entity: Record<string, string>;
}

/** One step of a moment's sequence: a brief for the agent plus where and
 * when it lands. Offsets are relative to the moment so a rescheduled show
 * moves its whole sequence. */
export interface BriefStep {
  step: string;
  platform: string;
  offsetHours: number;
  brief: string;
}

/** What sources read through — injected so a source never imports I/O of
 * its own and tests can stub both. */
export interface SourceDeps {
  supabase: SupabaseClient;
  executeTool: (
    toolSlug: string,
    userId: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
}

export interface CalendarSource {
  readonly id: string;
  /** Users this persona currently applies to (a connected store, upcoming
   * tour dates…) — the sweep iterates the union, so the cron handler never
   * learns source specifics (CM7 task 3). */
  candidates(deps: SourceDeps): Promise<string[]>;
  /** Whether this persona applies to the user at all — skipped sources cost
   * nothing in the sweep. */
  enabled(deps: SourceDeps, userId: string): Promise<boolean>;
  moments(
    deps: SourceDeps,
    userId: string,
    window: DateRange
  ): Promise<Moment[]>;
  /** The template of what to make: a moment expands into briefed steps. */
  brief(moment: Moment, brand: BrandSource | null): BriefStep[];
}

/** Shared brand-constraint suffix so every source's briefs carry the same
 * guardrails the copy linter enforces (CM5's lintCopy contract). */
export function brandConstraints(brand: BrandSource | null): string {
  if (!brand) return "";
  const parts: string[] = [];
  const banned = brand.voice?.banned ?? [];
  if (banned.length > 0) {
    parts.push(`Never use: ${banned.map((term) => `"${term}"`).join(", ")}.`);
  }
  const forbidden = brand.claims?.forbidden ?? [];
  if (forbidden.length > 0) {
    parts.push(
      `Forbidden claims: ${forbidden.map((claim) => `"${claim}"`).join(", ")}.`
    );
  }
  if (brand.voice?.register) {
    parts.push(`Write in a ${brand.voice.register} register.`);
  }
  return parts.length > 0 ? ` Brand constraints: ${parts.join(" ")}` : "";
}
