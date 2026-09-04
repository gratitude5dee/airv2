export interface MosaicEvent {
  id: string;
  title: string;
  starts_at: string;
  all_day: boolean;
  location?: string | null | undefined;
  attendees?: string[] | undefined;
  status?: string | undefined;
}

export type Cover =
  | { kind: "photos"; urls: string[] }
  | { kind: "plate"; color: string; count: number; initial: string };

function firstNonSpaceChar(value: string): string {
  return [...value].find((character) => !/\s/.test(character)) ?? "";
}

export function coverFor(
  dayEvents: MosaicEvent[],
  avatars: ReadonlyMap<string, { photoKey: string | null }>,
  toUrl: (key: string) => string,
  plateColor: string
): Cover {
  const ordered = [...dayEvents].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)
  );
  const emails = new Set<string>();
  for (const event of ordered) {
    for (const attendee of event.attendees ?? []) {
      emails.add(attendee.toLowerCase());
    }
  }
  const urls: string[] = [];
  for (const email of emails) {
    const key = avatars.get(email)?.photoKey;
    if (key) {
      urls.push(toUrl(key));
      if (urls.length === 4) break;
    }
  }
  if (urls.length > 0) return { kind: "photos", urls };
  const first = ordered[0];
  return {
    kind: "plate",
    color: plateColor,
    count: dayEvents.length,
    initial:
      dayEvents.length === 1
        ? firstNonSpaceChar(first?.title ?? "").toUpperCase() || "•"
        : "",
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function tiltFor(dayKey: string): number {
  return Number((((hashString(dayKey) % 9) - 4) * 0.6).toFixed(1));
}

export function subCopy(c: {
  events: number;
  people: number;
  pending: number;
}): string {
  const segments: string[] = [];
  if (c.events > 0) segments.push(`${c.events} event${c.events === 1 ? "" : "s"}`);
  if (c.people > 0) segments.push(`${c.people === 1 ? "1 person" : `${c.people} people`}`);
  if (c.pending > 0) segments.push(`${c.pending} pending`);
  return segments.length > 0 ? segments.join(" · ") : "No events";
}

export type Sticker =
  | { kind: "pending" }
  | { kind: "loc"; text: string; full: string }
  | { kind: "allday" };

export function stickersFor(dayEvents: MosaicEvent[]): Sticker[] {
  const stickers: Sticker[] = [];
  if (dayEvents.some((event) => event.status === "pending")) {
    stickers.push({ kind: "pending" });
  }
  const location = dayEvents.find((event) => Boolean(event.location?.trim()))?.location;
  if (location?.trim()) {
    const full = location.trim();
    stickers.push({
      kind: "loc",
      text: full.length > 14 ? `${full.slice(0, 13)}…` : full,
      full,
    });
  }
  if (dayEvents.some((event) => event.all_day)) {
    stickers.push({ kind: "allday" });
  }
  return stickers.slice(0, 2);
}

export function stripRowFor(rowIndex: number, rowCount: number): number {
  if (rowCount <= 0) return 0;
  return rowIndex > 0 ? rowIndex : 1;
}

export function staggerFor(index: number, origin: number): number {
  return 18 * Math.min(Math.abs(index - origin), 6);
}
