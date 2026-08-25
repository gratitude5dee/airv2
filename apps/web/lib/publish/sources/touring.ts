/**
 * CM7 task 2: the touring persona. Structured tour data (tour_dates rows)
 * supplies artist, venue, city, metro, date, on-sale — each show becomes
 * announce / on-sale / week-of / day-of / post-show moments. Every brief is
 * city-scoped: the creative names the venue and the copy is local — the
 * artist-specific thing generic tools do badly (CM7 task 2).
 */
import {
  brandConstraints,
  type BriefStep,
  type CalendarSource,
  type DateRange,
  type Moment,
  type SourceDeps,
} from "./source";
import type { BrandSource } from "@/lib/brand/types";

interface TourDateRow {
  id: string;
  artist: string;
  venue: string;
  city: string;
  metro: string | null;
  event_at: string;
  on_sale_at: string | null;
  timezone: string;
  status: string;
  created_at: string;
}

const SHOW_PHASES: ReadonlyArray<{
  kind: string;
  offsetHours: number;
}> = [
  { kind: "week_of", offsetHours: -7 * 24 },
  { kind: "day_of", offsetHours: 0 },
  { kind: "post_show", offsetHours: 24 },
];

export const touringSource: CalendarSource = {
  id: "touring",

  async candidates(deps: SourceDeps): Promise<string[]> {
    const { data } = await deps.supabase
      .from("tour_dates")
      .select("user_id")
      .neq("status", "cancelled")
      .gte("event_at", new Date().toISOString())
      .limit(500);
    return [...new Set((data ?? []).map((row) => row.user_id as string))];
  },

  async enabled(deps: SourceDeps, userId: string): Promise<boolean> {
    const { count } = await deps.supabase
      .from("tour_dates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .gte("event_at", new Date().toISOString());
    return (count ?? 0) > 0;
  },

  async moments(
    deps: SourceDeps,
    userId: string,
    window: DateRange
  ): Promise<Moment[]> {
    const { data } = await deps.supabase
      .from("tour_dates")
      .select(
        "id, artist, venue, city, metro, event_at, on_sale_at, timezone, status, created_at"
      )
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .gte("event_at", new Date().toISOString())
      .order("event_at", { ascending: true })
      .limit(100);
    const moments: Moment[] = [];
    for (const show of (data ?? []) as TourDateRow[]) {
      const entity = {
        artist: show.artist,
        venue: show.venue,
        city: show.city,
        ...(show.metro ? { metro: show.metro } : {}),
      };
      const announceAt = new Date(show.created_at);
      if (announceAt >= window.start && announceAt <= window.end) {
        moments.push({
          key: `announce:${show.id}`,
          kind: "announce",
          label: `Announce: ${show.artist} at ${show.venue}, ${show.city}`,
          occursAt: announceAt,
          timezone: show.timezone,
          entity,
        });
      }
      if (show.on_sale_at) {
        const onSaleAt = new Date(show.on_sale_at);
        if (onSaleAt >= window.start && onSaleAt <= window.end) {
          moments.push({
            key: `on_sale:${show.id}`,
            kind: "on_sale",
            label: `On sale: ${show.artist} at ${show.venue}, ${show.city}`,
            occursAt: onSaleAt,
            timezone: show.timezone,
            entity,
          });
        }
      }
      const eventAt = new Date(show.event_at);
      for (const phase of SHOW_PHASES) {
        const at = new Date(eventAt.getTime() + phase.offsetHours * 3600_000);
        if (at >= window.start && at <= window.end) {
          moments.push({
            key: `${phase.kind}:${show.id}`,
            kind: phase.kind,
            label: `${phase.kind.replace("_", " ")}: ${show.artist} at ${show.venue}, ${show.city}`,
            occursAt: at,
            timezone: show.timezone,
            entity,
          });
        }
      }
    }
    return moments;
  },

  brief(moment: Moment, brand: BrandSource | null): BriefStep[] {
    const constraints = brandConstraints(brand);
    const { artist, venue, city } = moment.entity;
    const metro = moment.entity["metro"] ?? city;
    const local =
      ` Name ${venue} explicitly; the copy is local to ${city} and any ad ` +
      `targets the ${metro} metro.`;
    switch (moment.kind) {
      case "announce":
        return [
          {
            step: "announce",
            platform: "instagram",
            offsetHours: 0,
            brief: `Announce ${artist} live at ${venue}, ${city}: date, venue, city — make it feel like local news.${local}${constraints}`,
          },
        ];
      case "on_sale":
        return [
          {
            step: "on-sale",
            platform: "instagram",
            offsetHours: 0,
            brief: `Tickets on sale now for ${artist} at ${venue}, ${city}. Single clear CTA to the ticket link.${local}${constraints}`,
          },
        ];
      case "week_of":
        return [
          {
            step: "week-of",
            platform: "instagram",
            offsetHours: 0,
            brief: `One week out: ${artist} plays ${venue}, ${city}. Build anticipation for the ${city} crowd specifically.${local}${constraints}`,
          },
        ];
      case "day_of":
        return [
          {
            step: "day-of",
            platform: "instagram",
            offsetHours: -6,
            brief: `Show day in ${city}: doors info, venue name, tonight energy.${local}${constraints}`,
          },
        ];
      default:
        return [
          {
            step: "post-show",
            platform: "instagram",
            offsetHours: 0,
            brief: `Thank ${city}: last night at ${venue}. Recap tone, gratitude, point to the next city.${local}${constraints}`,
          },
        ];
    }
  },
};
