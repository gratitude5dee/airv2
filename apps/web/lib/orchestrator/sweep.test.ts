import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findSweepableBoxes, NULL_DEADLINE_GRACE_MS } from "./sweep";

interface Row {
  provider_box_id: string;
  user_id: string;
  state: string;
  stop_after: string | null;
  last_active_at: string;
}

/** In-memory boxes table honoring the exact filters the sweeper uses. */
function makeSupabase(rows: Row[]): SupabaseClient {
  return {
    from: (table: string) => {
      expect(table).toBe("boxes");
      let matched = [...rows];
      const builder = {
        select: () => builder,
        lt: (column: string, value: string) => {
          matched = matched.filter((row) => {
            const current = row[column as keyof Row];
            return current !== null && (current as string) < value;
          });
          return builder;
        },
        is: (column: string, value: null) => {
          matched = matched.filter(
            (row) => row[column as keyof Row] === value
          );
          return builder;
        },
        in: (column: string, values: string[]) => {
          matched = matched.filter((row) =>
            values.includes(row[column as keyof Row] as string)
          );
          return builder;
        },
        then: (
          resolve: (result: { data: Row[] }) => unknown
        ): unknown => resolve({ data: matched }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const NOW = new Date("2026-08-20T12:00:00.000Z");
const beforeGrace = new Date(
  NOW.getTime() - NULL_DEADLINE_GRACE_MS - 60_000
).toISOString();
const withinGrace = new Date(NOW.getTime() - 60_000).toISOString();

describe("findSweepableBoxes", () => {
  it("catches boxes past their armed stop_after deadline", async () => {
    const supabase = makeSupabase([
      {
        provider_box_id: "b1",
        user_id: "u1",
        state: "ready",
        stop_after: new Date(NOW.getTime() - 1_000).toISOString(),
        last_active_at: withinGrace,
      },
    ]);
    const boxes = await findSweepableBoxes(supabase, NOW);
    expect(boxes.map((b) => b.provider_box_id)).toEqual(["b1"]);
  });

  it("catches ready boxes leaked with a NULL stop_after past the grace", async () => {
    const supabase = makeSupabase([
      {
        provider_box_id: "b2",
        user_id: "u2",
        state: "ready",
        stop_after: null,
        last_active_at: beforeGrace,
      },
    ]);
    const boxes = await findSweepableBoxes(supabase, NOW);
    expect(boxes.map((b) => b.provider_box_id)).toEqual(["b2"]);
  });

  it("leaves an in-flight NULL-deadline box within the grace alone", async () => {
    const supabase = makeSupabase([
      {
        provider_box_id: "b3",
        user_id: "u3",
        state: "ready",
        stop_after: null,
        last_active_at: withinGrace,
      },
    ]);
    expect(await findSweepableBoxes(supabase, NOW)).toEqual([]);
  });

  it("never selects stopped boxes and never returns duplicates", async () => {
    const supabase = makeSupabase([
      {
        provider_box_id: "b4",
        user_id: "u4",
        state: "stopped",
        stop_after: null,
        last_active_at: beforeGrace,
      },
      {
        provider_box_id: "b5",
        user_id: "u5",
        state: "idle",
        stop_after: new Date(NOW.getTime() - 1_000).toISOString(),
        last_active_at: beforeGrace,
      },
    ]);
    const boxes = await findSweepableBoxes(supabase, NOW);
    expect(boxes.map((b) => b.provider_box_id)).toEqual(["b5"]);
  });
});
