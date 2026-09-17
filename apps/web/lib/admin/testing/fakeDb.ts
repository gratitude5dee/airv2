/**
 * An in-memory stand-in for the PostgREST query shapes the V12 admin routes
 * use (select with eq/is/in/gte/lte/not-is-null filters, order, limit,
 * range, maybeSingle; insert; update ... select). Test-only — imported by
 * app/api/admin/**\/route.test.ts files. Tables are plain row arrays;
 * `errors[table]` makes every read of that table fail the way an unapplied
 * migration does.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;

interface Result {
  data: Row[] | Row | null;
  error: { message: string } | null;
  count: number | null;
}

export class AdminFakeDb {
  tables: Record<string, Row[]> = {};
  errors: Record<string, { message: string } | undefined> = {};
  inserts: { table: string; row: Row }[] = [];
  updates: { table: string; patch: Row }[] = [];
  /** Every filter applied, for asserting which columns a route narrows on. */
  filters: { table: string; op: string; column: string; value: unknown }[] = [];

  rows(table: string): Row[] {
    return (this.tables[table] ??= []);
  }

  reset(): void {
    this.tables = {};
    this.errors = {};
    this.inserts = [];
    this.updates = [];
    this.filters = [];
  }

  client(): SupabaseClient {
    return {
      from: (table: string) => makeBuilder(this, table),
    } as unknown as SupabaseClient;
  }
}

function makeBuilder(db: AdminFakeDb, table: string) {
  const filters: ((row: Row) => boolean)[] = [];
  let mode: "select" | "insert" | "update" = "select";
  let patch: Row = {};
  let single = false;
  let order: { column: string; ascending: boolean } | null = null;
  let from = 0;
  let to = Number.POSITIVE_INFINITY;

  const execute = (): Result => {
    const error = db.errors[table];
    if (error) return { data: null, error, count: null };
    const rows = db.rows(table);
    if (mode === "insert") {
      const inserted = { id: randomUUID(), ...patch };
      rows.push(inserted);
      db.inserts.push({ table, row: inserted });
      return { data: single ? inserted : [inserted], error: null, count: 1 };
    }
    let matched = rows.filter((row) => filters.every((filter) => filter(row)));
    if (mode === "update") {
      for (const row of matched) Object.assign(row, patch);
      db.updates.push({ table, patch });
    }
    if (order) {
      const { column, ascending } = order;
      matched = [...matched].sort((a, b) => {
        const left = String(a[column] ?? "");
        const right = String(b[column] ?? "");
        return ascending
          ? left.localeCompare(right)
          : right.localeCompare(left);
      });
    }
    const sliced = matched.slice(from, to + 1);
    return {
      data: single ? (sliced[0] ?? null) : sliced,
      error: null,
      count: matched.length,
    };
  };

  const record = (op: string, column: string, value: unknown) => {
    db.filters.push({ table, op, column, value });
  };

  const api = {
    select() {
      return api;
    },
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
    eq(column: string, value: unknown) {
      record("eq", column, value);
      filters.push((row) => row[column] === value);
      return api;
    },
    is(column: string, value: unknown) {
      record("is", column, value);
      filters.push((row) => (row[column] ?? null) === value);
      return api;
    },
    not(column: string, operator: string, value: unknown) {
      record(`not.${operator}`, column, value);
      if (operator === "is")
        filters.push((row) => (row[column] ?? null) !== value);
      return api;
    },
    in(column: string, values: unknown[]) {
      record("in", column, values);
      filters.push((row) => values.includes(row[column]));
      return api;
    },
    gte(column: string, value: string) {
      record("gte", column, value);
      filters.push((row) => String(row[column] ?? "") >= value);
      return api;
    },
    lte(column: string, value: string) {
      record("lte", column, value);
      filters.push((row) => String(row[column] ?? "") <= value);
      return api;
    },
    order(column: string, options?: { ascending?: boolean }) {
      order = { column, ascending: options?.ascending !== false };
      return api;
    },
    limit(count: number) {
      from = 0;
      to = count - 1;
      return api;
    },
    range(start: number, end: number) {
      from = start;
      to = end;
      return api;
    },
    single() {
      single = true;
      return api;
    },
    maybeSingle() {
      single = true;
      return api;
    },
    then(
      resolve: (result: Result) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve().then(execute).then(resolve, reject);
    },
  };
  return api;
}
