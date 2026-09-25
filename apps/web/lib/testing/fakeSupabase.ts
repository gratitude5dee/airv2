/**
 * The one shared Supabase/PostgREST fake for the whole suite. Every test
 * builds its client with `new FakeSupabase().client()` (or `db.client()`):
 * the fake records every filter (`db.filters`), every executed query
 * (`db.queries`), every mutation (`db.inserts`/`updates`/`upserts`/`deletes`)
 * and every `rpc` call (`db.rpcCalls`) so tests assert *what was asked*, not
 * just what a canned chain returned. Tables are plain row arrays;
 * `errors[table]` fails every op on that table the way an unapplied
 * migration does, `opErrors["table:mode"]` fails one op kind only, and
 * `resolve(q)` overrides a query's result entirely for cases table state
 * cannot express (sequences, cross-call behavior).
 *
 * `uniques[table] = ["slug"]` makes insert/upsert reject with a 23505-shaped
 * error when a row with the same key already exists.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";

export type Row = Record<string, unknown>;
export interface FakeError {
  message: string;
  code?: string;
}
export interface FakeResult {
  data: unknown;
  error: FakeError | null;
  count: number | null;
}
export interface RecordedFilter {
  table: string;
  op: string;
  column: string;
  value: unknown;
}
export interface RecordedQuery {
  table: string;
  mode: "select" | "insert" | "update" | "upsert" | "delete" | "rpc";
  /** Arguments passed to the mode method (row(s), patch, options). */
  args: unknown[];
  /** Filters applied on this builder chain, in order. */
  filters: RecordedFilter[];
  /** `.select()` was chained after a write. */
  returning: boolean;
  /** `.single()`/`.maybeSingle()` was chained. */
  single: boolean;
}

type Mode = RecordedQuery["mode"];

const WRITES: readonly Mode[] = ["insert", "update", "upsert", "delete"];

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  /** Column defaults merged under each inserted row (Postgres DEFAULT
   * expressions), e.g. `defaults["create_intakes"] = { opened_at: () => ... }`.
   * A function is evaluated per row. */
  defaults: Record<string, Row | ((row: Row) => Row)> = {};
  /** Fails every op on the table (as an unapplied migration would). */
  errors: Record<string, FakeError | undefined> = {};
  /** Fails one op kind on the table, e.g. `opErrors["mini_apps:update"]`. */
  opErrors: Record<string, FakeError | undefined> = {};
  /** Unique keys per table: insert/upsert collide on these columns. An entry
   * may name several columns (`"app_id,version"`) for a composite key — the
   * violation fires when every listed column matches. */
  uniques: Record<string, string[]> = {};
  /** Embedded-join resolvers: `embeds[table][name]` decorates each row a
   * select (or returning write) yields, standing in for `name!inner(...)`
   * projections. Evaluated at read time against live table state. */
  embeds: Record<string, Record<string, (row: Row, db: FakeSupabase) => unknown>> = {};
  inserts: { table: string; row: Row }[] = [];
  updates: { table: string; patch: Row }[] = [];
  upserts: { table: string; row: Row }[] = [];
  deletes: { table: string; rows: Row[] }[] = [];
  /** Every filter applied, for asserting which columns a route narrows on. */
  filters: RecordedFilter[] = [];
  /** Every executed query, in order. */
  queries: RecordedQuery[] = [];
  /** `rpc(name, args)` results: value or `(args) => result`. */
  rpcResults: Record<string, unknown | ((args: unknown) => unknown)> = {};
  rpcErrors: Record<string, FakeError | undefined> = {};
  rpcCalls: { fn: string; args: unknown }[] = [];
  /** Storage buckets and recorded calls; replace members freely. */
  storageCalls: { bucket: string; method: string; args: unknown[] }[] = [];
  /** Object bodies served by `storage.download()`, keyed
   * `"${bucket}/${path}"`. `upload()` writes here, `remove()` deletes. */
  storageObjects: Record<string, Blob | Uint8Array | string> = {};
  /** Overrides: return a partial result to answer a query without tables. */
  resolve: ((q: RecordedQuery) => Partial<FakeResult> | undefined) | undefined;

  rows(table: string): Row[] {
    return (this.tables[table] ??= []);
  }

  reset(): void {
    this.tables = {};
    this.errors = {};
    this.opErrors = {};
    this.uniques = {};
    this.inserts = [];
    this.updates = [];
    this.upserts = [];
    this.deletes = [];
    this.filters = [];
    this.queries = [];
    this.rpcResults = {};
    this.rpcErrors = {};
    this.rpcCalls = [];
    this.storageCalls = [];
    this.storageObjects = {};
    this.defaults = {};
    this.embeds = {};
    this.resolve = undefined;
  }

  /**
   * Assert the suite asked the table for a column with a given op/value.
   * `expectQuery({ table: "users", filters: { id: "u1" } })` checks eq;
   * pass `[{ op: "in", column: "kind", value: [...] }]` for other ops.
   */
  expectQuery({
    table,
    filters,
  }: {
    table: string;
    filters: Record<string, unknown> | { op?: string; column: string; value?: unknown }[];
  }): void {
    const wanted = Array.isArray(filters)
      ? filters
      : Object.entries(filters).map(([column, value]) => ({ op: "eq", column, value }));
    for (const want of wanted) {
      const op = want.op ?? "eq";
      const hit = this.filters.find(
        (f) =>
          f.table === table &&
          f.op === op &&
          f.column === want.column &&
          deepEqual(f.value, want.value),
      );
      expect(
        hit,
        `expected a ${op} filter on ${table}.${want.column} = ${JSON.stringify(
          want.value,
        )}\nrecorded filters: ${JSON.stringify(this.filters, null, 2)}`,
      ).toBeTruthy();
    }
  }

  client(): SupabaseClient {
    const db = this;
    const storage = {
      from: (bucket: string) => ({
        upload: async (...args: unknown[]) => {
          db.storageCalls.push({ bucket, method: "upload", args });
          const body = args[1];
          if (body instanceof Blob || body instanceof Uint8Array || typeof body === "string") {
            db.storageObjects[`${bucket}/${String(args[0] ?? "file")}`] = body;
          }
          return { data: { path: String(args[0] ?? "file") }, error: null };
        },
        download: async (...args: unknown[]) => {
          db.storageCalls.push({ bucket, method: "download", args });
          const stored = db.storageObjects[`${bucket}/${String(args[0] ?? "file")}`];
          const data =
            stored === undefined
              ? new Blob([])
              : stored instanceof Blob
                ? stored
                : new Blob([stored as BlobPart]);
          return { data, error: null };
        },
        createSignedUrl: async (...args: unknown[]) => {
          db.storageCalls.push({ bucket, method: "createSignedUrl", args });
          return {
            data: { signedUrl: `https://storage.test/${bucket}/${String(args[0] ?? "file")}` },
            error: null,
          };
        },
        remove: async (...args: unknown[]) => {
          db.storageCalls.push({ bucket, method: "remove", args });
          const keys = Array.isArray(args[0]) ? args[0] : [args[0]];
          for (const key of keys) delete db.storageObjects[`${bucket}/${String(key)}`];
          return { data: [], error: null };
        },
        list: async (...args: unknown[]) => {
          db.storageCalls.push({ bucket, method: "list", args });
          return { data: [], error: null };
        },
        getPublicUrl: (...args: unknown[]) => ({
          data: { publicUrl: `https://storage.test/${bucket}/${String(args[0] ?? "file")}` },
        }),
      }),
    };
    const client = {
      from: (table: string) => makeBuilder(db, table),
      rpc: async (fn: string, args?: unknown) => {
        db.rpcCalls.push({ fn, args });
        const error = db.rpcErrors[fn];
        if (error) return { data: null, error };
        const resolved = db.resolve?.({
          table: fn,
          mode: "rpc",
          args: args === undefined ? [] : [args],
          filters: [],
          returning: false,
          single: false,
        });
        if (resolved !== undefined) {
          return { data: resolved.data ?? null, error: resolved.error ?? null };
        }
        const result = db.rpcResults[fn];
        const data = typeof result === "function" ? result(args) : result;
        return { data: data ?? null, error: null };
      },
      schema: (schema: string) => ({
        ...client,
        from: (table: string) => makeBuilder(db, `${schema}.${table}`),
      }),
      storage,
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
      functions: {
        invoke: async (name: string, options?: { body?: unknown }) => {
          const result = db.rpcResults[`functions:${name}`];
          const data = typeof result === "function" ? result(options?.body) : result;
          return { data: data ?? null, error: db.rpcErrors[`functions:${name}`] ?? null };
        },
      },
      channel: (name: string) => {
        const channel = {
          on: () => channel,
          subscribe: (cb?: (status: string) => void) => {
            cb?.("SUBSCRIBED");
            return channel;
          },
          unsubscribe: async () => "ok" as const,
        };
        return channel;
      },
      removeChannel: async () => "ok" as const,
      removeAllChannels: async () => {},
    };
    return client as unknown as SupabaseClient;
  }
}

/** Backwards-compatible alias while call sites move over. */
export { FakeSupabase as AdminFakeDb };

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) =>
        deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return false;
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function likeToRegex(pattern: string, insensitive: boolean): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, insensitive ? "i" : "");
}

function parseOrValue(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.replace(/^"|"$/g, "");
}

function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function orTerm(term: string): (row: Row) => boolean {
  const trimmed = term.trim().replace(/^\((.*)\)$/, "$1");
  const andMatch = trimmed.match(/^and\((.*)\)$/);
  if (andMatch) {
    const inner = splitTopLevel(andMatch[1] ?? "");
    const preds = inner.map(orTerm);
    return (row) => preds.every((p) => p(row));
  }
  const orMatch = trimmed.match(/^or\((.*)\)$/);
  if (orMatch) {
    const inner = splitTopLevel(orMatch[1] ?? "");
    const preds = inner.map(orTerm);
    return (row) => preds.some((p) => p(row));
  }
  const notMatch = trimmed.match(/^(.+?)\.not\.(.+)$/);
  if (notMatch) {
    const [, column, rest] = notMatch;
    const [op, ...valueParts] = rest!.split(".");
    const inner = makePredicate(column!.trim(), op!, parseOrValue(valueParts.join(".")));
    return (row) => !inner(row);
  }
  const [column, op, ...valueParts] = trimmed.split(".");
  const raw = valueParts.join(".");
  const value = raw.startsWith("(") && raw.endsWith(")")
    ? splitTopLevel(raw.slice(1, -1)).map(parseOrValue)
    : parseOrValue(raw);
  return makePredicate(column!.trim(), op!, value);
}

function orPredicate(clause: string): (row: Row) => boolean {
  const inner = clause.replace(/^or=/, "").replace(/^\((.*)\)$/, "$1");
  const predicates = splitTopLevel(inner).map(orTerm);
  return (row) => predicates.some((p) => p(row));
}

function makePredicate(column: string, op: string, value: unknown): (row: Row) => boolean {
  switch (op) {
    case "eq":
      return (row) => row[column] === value;
    case "neq":
      return (row) => row[column] !== value;
    case "gt":
      return (row) => compare(row[column], value) > 0;
    case "gte":
      return (row) => compare(row[column], value) >= 0;
    case "lt":
      return (row) => compare(row[column], value) < 0;
    case "lte":
      return (row) => compare(row[column], value) <= 0;
    case "is":
      return (row) => (row[column] ?? null) === value;
    case "in": {
      // `.in()` passes a real array; `.not(col,"in",...)` and
      // `.filter(col,"in",...)` arrive as the PostgREST "(a,b,c)" string —
      // parse it the same way `or(...)` terms already do.
      const values = Array.isArray(value)
        ? value
        : typeof value === "string" && value.startsWith("(") && value.endsWith(")")
          ? splitTopLevel(value.slice(1, -1)).map(parseOrValue)
          : [value];
      return (row) => values.some((v) => row[column] === v || String(row[column]) === String(v));
    }
    case "like":
      return (row) => likeToRegex(String(value), false).test(String(row[column] ?? ""));
    case "ilike":
      return (row) => likeToRegex(String(value), true).test(String(row[column] ?? ""));
    case "not":
      return (row) => row[column] !== value;
    default:
      return () => true;
  }
}

function makeBuilder(db: FakeSupabase, table: string) {
  const predicates: { op: string; column: string; value: unknown; test: (row: Row) => boolean }[] = [];
  let mode: Mode = "select";
  let modeArgs: unknown[] = [];
  let patch: Row | Row[] = {};
  let onConflict: string | undefined;
  let single: "single" | "maybeSingle" | null = null;
  let returning = false;
  let orders: { column: string; ascending: boolean }[] = [];
  let offset = 0;
  let limitCount: number | null = null;

  const record = (op: string, column: string, value: unknown) => {
    db.filters.push({ table, op, column, value });
  };
  const addFilter = (op: string, column: string, value: unknown, test: (row: Row) => boolean) => {
    record(op, column, value);
    predicates.push({ op, column, value, test });
  };

  const failWith = (): FakeResult | null => {
    const error = db.opErrors[`${table}:${mode}`] ?? db.errors[table];
    if (error) return { data: null, error, count: null };
    return null;
  };

  const uniqueViolation = (row: Row): FakeError | null => {
    for (const key of db.uniques[table] ?? []) {
      const columns = key.split(",").map((column) => column.trim());
      const hit = db
        .rows(table)
        .find((existing) =>
          columns.every((column) => deepEqual(existing[column], row[column])),
        );
      if (hit)
        return {
          code: "23505",
          message: `duplicate key value violates unique constraint "${table}_${key.replaceAll(",", "_")}_key"`,
        };
    }
    return null;
  };

  const withEmbeds = (row: Row): Row => {
    const defs = db.embeds[table];
    if (!defs) return row;
    const out = { ...row };
    for (const [name, resolve] of Object.entries(defs)) {
      out[name] = resolve(row, db);
    }
    return out;
  };

  const execute = (): FakeResult => {
    const query: RecordedQuery = {
      table,
      mode,
      args: modeArgs,
      filters: predicates.map(({ op, column, value }) => ({ table, op, column, value })),
      returning,
      single: single !== null,
    };
    db.queries.push(query);
    const resolved = db.resolve?.(query);
    if (resolved !== undefined) {
      return {
        data: resolved.data ?? null,
        error: resolved.error ?? null,
        count: resolved.count ?? null,
      };
    }
    const failed = failWith();
    if (failed) return failed;

    const all = db.rows(table);
    if (mode === "insert" || mode === "upsert") {
      const rows = Array.isArray(patch) ? patch : [patch];
      const def = db.defaults[table];
      const withDefaults = (row: Row): Row => ({
        id: randomUUID(),
        ...(typeof def === "function" ? def(row) : (def ?? {})),
        ...row,
      });
      if (mode === "upsert") {
        const keys = (db.uniques[table] ?? (onConflict ? [onConflict] : ["id"])).flatMap((key) =>
          key.split(",").map((column) => column.trim()),
        );
        const inserted: Row[] = [];
        for (const row of rows) {
          const hit = all.find((existing) =>
            keys.every((key) => deepEqual(existing[key], row[key])),
          );
          if (hit) Object.assign(hit, row);
          else {
            const next = withDefaults(row);
            all.push(next);
            inserted.push(next);
          }
          db.upserts.push({ table, row });
        }
        return {
          data: returning ? (single ? (inserted[0] ?? null) : inserted.map(withEmbeds)) : null,
          error: null,
          count: inserted.length,
        };
      }
      for (const row of rows) {
        const violation = uniqueViolation(row);
        if (violation) return { data: null, error: violation, count: null };
      }
      const inserted = rows.map((row) => {
        const next = withDefaults(row);
        all.push(next);
        db.inserts.push({ table, row: next });
        return next;
      });
      return {
        data: single ? (inserted.map(withEmbeds)[0] ?? null) : inserted.map(withEmbeds),
        error: null,
        count: inserted.length,
      };
    }

    let matched = all.filter((row) => predicates.every(({ test }) => test(row)));

    if (mode === "update") {
      for (const row of matched) Object.assign(row, patch as Row);
      db.updates.push({ table, patch: patch as Row });
      if (!returning) return { data: null, error: null, count: matched.length };
    }
    if (mode === "delete") {
      db.tables[table] = all.filter((row) => !matched.includes(row));
      db.deletes.push({ table, rows: matched });
      if (!returning) return { data: null, error: null, count: matched.length };
    }
    for (const { column, ascending } of orders) {
      matched = [...matched].sort((a, b) => {
        const c = compare(a[column], b[column]);
        return ascending ? c : -c;
      });
    }
    const sliced = matched
      .slice(offset, limitCount === null ? undefined : offset + limitCount)
      .map(withEmbeds);
    if (single === "single" && sliced.length !== 1) {
      return {
        data: null,
        error: {
          code: "PGRST116",
          message: `JSON object requested, ${sliced.length === 0 ? "no" : "multiple"} rows returned`,
        },
        count: sliced.length,
      };
    }
    return {
      data: single ? (sliced[0] ?? null) : sliced,
      error: null,
      count: matched.length,
    };
  };

  const api = {
    select(...args: unknown[]) {
      if (WRITES.includes(mode)) returning = true;
      else modeArgs = args;
      return api;
    },
    insert(row: Row | Row[], options?: { onConflict?: string }) {
      mode = "insert";
      modeArgs = [row, options];
      patch = row;
      onConflict = options?.onConflict;
      return api;
    },
    update(values: Row) {
      mode = "update";
      modeArgs = [values];
      patch = values;
      return api;
    },
    upsert(row: Row | Row[], options?: { onConflict?: string }) {
      mode = "upsert";
      modeArgs = [row, options];
      patch = row;
      onConflict = options?.onConflict;
      return api;
    },
    delete() {
      mode = "delete";
      return api;
    },
    eq(column: string, value: unknown) {
      addFilter("eq", column, value, (row) => row[column] === value);
      return api;
    },
    neq(column: string, value: unknown) {
      addFilter("neq", column, value, (row) => row[column] !== value);
      return api;
    },
    is(column: string, value: unknown) {
      addFilter("is", column, value, (row) => (row[column] ?? null) === value);
      return api;
    },
    not(column: string, operator: string, value: unknown) {
      const inner = makePredicate(column, operator, value);
      addFilter(`not.${operator}`, column, value, (row) => !inner(row));
      return api;
    },
    in(column: string, values: unknown[]) {
      addFilter("in", column, values, (row) =>
        values.some((v) => row[column] === v || String(row[column]) === String(v)),
      );
      return api;
    },
    gt(column: string, value: unknown) {
      addFilter("gt", column, value, (row) => compare(row[column], value) > 0);
      return api;
    },
    gte(column: string, value: unknown) {
      addFilter("gte", column, value, (row) => compare(row[column], value) >= 0);
      return api;
    },
    lt(column: string, value: unknown) {
      addFilter("lt", column, value, (row) => compare(row[column], value) < 0);
      return api;
    },
    lte(column: string, value: unknown) {
      addFilter("lte", column, value, (row) => compare(row[column], value) <= 0);
      return api;
    },
    like(column: string, pattern: string) {
      const re = likeToRegex(pattern, false);
      addFilter("like", column, pattern, (row) => re.test(String(row[column] ?? "")));
      return api;
    },
    ilike(column: string, pattern: string) {
      const re = likeToRegex(pattern, true);
      addFilter("ilike", column, pattern, (row) => re.test(String(row[column] ?? "")));
      return api;
    },
    or(clause: string) {
      record("or", "*", clause);
      predicates.push({ op: "or", column: "*", value: clause, test: orPredicate(clause) });
      return api;
    },
    match(values: Row) {
      for (const [column, value] of Object.entries(values)) api.eq(column, value);
      return api;
    },
    contains(column: string, value: unknown) {
      addFilter("contains", column, value, (row) => {
        const haystack = row[column];
        const needles = typeof value === "string" ? JSON.parse(value) : value;
        const list = Array.isArray(needles) ? needles : [needles];
        return Array.isArray(haystack) && list.every((needle) => haystack.some((h) => deepEqual(h, needle)));
      });
      return api;
    },
    filter(column: string, operator: string, value: unknown) {
      const op = operator.replace(/^not\./, "not.");
      if (op.startsWith("not.")) return api.not(column, op.slice(4), value);
      const test = makePredicate(column, op, value);
      addFilter(op, column, value, test);
      return api;
    },
    order(column: string, options?: { ascending?: boolean }) {
      orders.push({ column, ascending: options?.ascending !== false });
      return api;
    },
    limit(count: number) {
      limitCount = count;
      return api;
    },
    range(from: number, to: number) {
      offset = from;
      limitCount = to - from + 1;
      return api;
    },
    single() {
      single = "single";
      return api;
    },
    maybeSingle() {
      single = "maybeSingle";
      return api;
    },
    then(
      resolve: (result: FakeResult) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve().then(execute).then(resolve, reject);
    },
  };
  return api;
}
