/**
 * CM7 source registry. Adding a persona = adding a file in this directory
 * and one line here; lib/publish/ and the cron handler never change.
 */
import type { CalendarSource } from "./source";
import { ecommerceSource } from "./ecommerce";
import { touringSource } from "./touring";

const SOURCES: Record<string, CalendarSource> = {
  [ecommerceSource.id]: ecommerceSource,
  [touringSource.id]: touringSource,
};

export function allSources(): CalendarSource[] {
  return Object.values(SOURCES);
}

export function sourceFor(id: string): CalendarSource | null {
  if (!Object.prototype.hasOwnProperty.call(SOURCES, id)) return null;
  return SOURCES[id] ?? null;
}

export type {
  BriefStep,
  CalendarSource,
  DateRange,
  Moment,
  SourceDeps,
} from "./source";
