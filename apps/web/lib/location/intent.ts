/**
 * Deterministic location intent (ported verbatim from mayor-coast's
 * inbound.ts detectLocationIntent): a "near me" / "get me directions" burst
 * is classified without a model call so the flush lane can hold it behind a
 * Find My share. The detector produces the request's search hint only —
 * never coordinates; those never reach Postgres (C4).
 */

export type LocationPurpose = "nearby" | "directions";
export type LocationEntityType = "place" | "event" | "any";
export type LocationTravelMode =
  | "driving"
  | "transit"
  | "bicycling"
  | "walking";

export interface LocationIntent {
  purpose: LocationPurpose;
  entityType: LocationEntityType;
  searchText?: string;
  travelMode: LocationTravelMode;
}

const DIRECTIONS_RE =
  /\b(?:get|give|show|need|want|send)?.{0,24}\b(?:directions?|route|navigate|map me)\b/u;

const NEARBY_RE =
  /\b(?:what|anything|something|places?|spots?|events?|food|drinks?).{0,32}\b(?:near me|nearby|around me|close by)\b/u;
const NEARBY_BARE_RE = /\b(?:near me|nearby|around me|close by)\b/u;

const SEARCH_HINTS: readonly {
  pattern: RegExp;
  searchText: string;
  entityType: LocationEntityType;
}[] = [
  {
    pattern:
      /\b(?:pizza|food|eat|restaurant|dinner|brunch|coffee|drink|bar|cocktail)\b/u,
    searchText: "food drinks",
    entityType: "place",
  },
  {
    pattern:
      /\b(?:music|concert|comedy|art|gallery|party|nightlife|event)\b/u,
    searchText: "events nightlife",
    entityType: "event",
  },
];

function entityTypeFor(text: string): {
  entityType: LocationEntityType;
  searchText: string | undefined;
} {
  for (const hint of SEARCH_HINTS) {
    if (hint.pattern.test(text)) {
      return { entityType: hint.entityType, searchText: hint.searchText };
    }
  }
  return { entityType: "any", searchText: undefined };
}

function travelModeFor(text: string): LocationTravelMode {
  if (/\b(?:drive|driving|car)\b/u.test(text)) return "driving";
  if (/\b(?:transit|bus|train|subway|metro)\b/u.test(text)) return "transit";
  if (/\b(?:bike|biking|bicycle|cycling)\b/u.test(text)) return "bicycling";
  return "walking";
}

/**
 * Classify a settled burst. Returns null for ordinary prose — only an
 * explicit near-me / directions phrasing takes the Find My lane.
 */
export function detectLocationIntent(text: string): LocationIntent | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  const travelMode = travelModeFor(normalized);
  if (DIRECTIONS_RE.test(normalized)) {
    return { purpose: "directions", entityType: "any", travelMode };
  }
  if (NEARBY_RE.test(normalized) || NEARBY_BARE_RE.test(normalized)) {
    const { entityType, searchText } = entityTypeFor(normalized);
    return {
      purpose: "nearby",
      entityType,
      ...(searchText ? { searchText } : {}),
      travelMode,
    };
  }
  return null;
}

/** mayor-coast's acknowledgement fast-path — the user confirming they
 * tapped the Find My card. */
export function isLocationAcknowledgement(text: string): boolean {
  return /^(?:shared|done|use my location|sent location|location shared)[.!\s]*$/iu.test(
    text.trim()
  );
}

/** The marker the inbound webhook persists for a private Find My share —
 * identifiers only, no coordinates (C4). */
export const LOCATION_SHARED_BODY = "[location shared]";
