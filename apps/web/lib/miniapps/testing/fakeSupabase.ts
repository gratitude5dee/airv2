/**
 * A minimal in-memory stand-in for the handful of PostgREST query shapes the
 * mini-app link lanes use (select/insert/update with eq/is/gt filters,
 * order/limit/maybeSingle). Test-only — imported by *.test.ts files.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

const TABLE_DEFAULTS: Record<string, () => Row> = {
  berd_pairing_codes: () => ({ used_at: null }),
  berd_links: () => ({
    status: "paired",
    protocol_version: null,
    paired_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    revoked_at: null,
  }),
  buzz_pairing_codes: () => ({ used_at: null }),
  buzz_links: () => ({
    status: "connected",
    community_label: null,
    paired_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    revoked_at: null,
  }),
};

export class FakeDb {
  readonly tables = new Map<string, Row[]>();

  rows(table: string): Row[] {
    let rows = this.tables.get(table);
    if (!rows) {
      rows = [];
      this.tables.set(table, rows);
    }
    return rows;
  }

  client(): SupabaseClient {
    const from = (table: string) => makeBuilder(this.rows(table), table);
    return { from } as unknown as SupabaseClient;
  }
}

interface Result {
  data: Row[] | Row | null;
  error: null;
}

function makeBuilder(rows: Row[], table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  let mode: "select" | "update" | "insert" = "select";
  let patch: Row = {};
  let single = false;
  let max = Number.POSITIVE_INFINITY;

  const execute = (): Result => {
    if (mode === "insert") {
      rows.push({
        id: randomUUID(),
        ...(TABLE_DEFAULTS[table]?.() ?? {}),
        ...patch,
      });
      return { data: null, error: null };
    }
    const matched = rows.filter((row) => filters.every((f) => f(row)));
    if (mode === "update") {
      for (const row of matched) Object.assign(row, patch);
    }
    const limited = matched.slice(0, max);
    return {
      data: single ? (limited[0] ?? null) : limited,
      error: null,
    };
  };

  const api = {
    insert(row: Row) {
      mode = "insert";
      patch = row;
      return api;
    },
    update(values: Row) {
      mode = "update";
      patch = values;
      return api;
    },
    select() {
      return api;
    },
    eq(key: string, value: unknown) {
      filters.push((row) => row[key] === value);
      return api;
    },
    is(key: string, value: unknown) {
      filters.push((row) => (row[key] ?? null) === value);
      return api;
    },
    gt(key: string, value: string) {
      filters.push((row) => String(row[key] ?? "") > value);
      return api;
    },
    order() {
      return api;
    },
    limit(count: number) {
      max = count;
      return api;
    },
    maybeSingle() {
      single = true;
      max = 1;
      return api;
    },
    then(
      resolve: (result: Result) => unknown,
      reject?: (error: unknown) => unknown
    ) {
      try {
        return Promise.resolve(execute()).then(resolve, reject);
      } catch (error) {
        return Promise.reject(error).then(resolve, reject);
      }
    },
  };
  return api;
}
