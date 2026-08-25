/**
 * MA9.3 — the receipts layer: one flat, stable-keyed row shape over the five
 * per-user ledgers (agent_runs, decisions, vault_events, miniapp_gate_events,
 * creative_jobs). Receipts are metadata by construction (C4): message bodies,
 * prompts, memory, and documents live box-side and never appear here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Stable column set — every receipt row carries every key (null when not
 * applicable) so a day's JSONL round-trips into a dataframe cleanly. */
export const RECEIPT_COLUMNS = [
  "ts",
  "kind",
  "id",
  "ref",
  "status",
  "label",
  "platform",
  "app_id",
  "ended_at",
  "box_seconds",
  "cost_usd",
] as const;

export type ReceiptColumn = (typeof RECEIPT_COLUMNS)[number];

export type TraceReceipt = Record<ReceiptColumn, string | number | null>;

export interface TraceWindow {
  /** Inclusive ISO lower bound on the row's primary timestamp. */
  from?: string | undefined;
  /** Exclusive ISO upper bound. */
  to?: string | undefined;
}

function receipt(partial: Partial<TraceReceipt>): TraceReceipt {
  const row = {} as TraceReceipt;
  for (const column of RECEIPT_COLUMNS) {
    row[column] = partial[column] ?? null;
  }
  return row;
}

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const str = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const num = (value: unknown): number | null =>
  typeof value === "number" ? value : null;

export function mapAgentRun(row: Row): TraceReceipt {
  return receipt({
    ts: str(row.started_at),
    kind: "agent_run",
    id: str(row.id),
    ref: str(row.hermes_run_id),
    status: str(row.outcome),
    label: str(row.trigger),
    ended_at: str(row.ended_at),
    box_seconds: num(row.box_seconds),
    cost_usd: num(row.cost_usd),
  });
}

export function mapDecision(row: Row): TraceReceipt {
  return receipt({
    ts: str(row.created_at),
    kind: "decision",
    id: str(row.id),
    ref: str(row.ref),
    status: str(row.status),
    label: str(row.kind),
    platform: str(row.platform),
    ended_at: str(row.resolved_at),
  });
}

export function mapVaultEvent(row: Row): TraceReceipt {
  return receipt({
    ts: str(row.created_at),
    kind: "vault_event",
    id: str(row.id),
    ref: str(row.item_id),
    label: str(row.action),
  });
}

export function mapGateEvent(row: Row): TraceReceipt {
  return receipt({
    ts: str(row.created_at),
    kind: "gate_event",
    id: str(row.id),
    ref: str(row.ref),
    label: str(row.kind),
    app_id: str(row.app_id),
  });
}

export function mapCreativeJob(row: Row): TraceReceipt {
  const channel = str(row.channel);
  const mode = str(row.mode);
  return receipt({
    ts: str(row.created_at),
    kind: "creative_job",
    id: str(row.id),
    ref: str(row.provider_request_id),
    status: str(row.status),
    label: channel && mode ? `${channel}/${mode}` : (channel ?? mode),
    ended_at: str(row.delivered_at),
  });
}

interface Source {
  table: string;
  tsColumn: string;
  select: string;
  map: (row: Row) => TraceReceipt;
}

/** Explicit select lists: only metadata columns ride the export. Columns
 * that can carry free text authored around content (decision labels/payloads,
 * creative errors, vault event context) are deliberately excluded. */
const SOURCES: readonly Source[] = [
  {
    table: "agent_runs",
    tsColumn: "started_at",
    select:
      "id, hermes_run_id, trigger, started_at, ended_at, outcome, box_seconds, cost_usd",
    map: mapAgentRun,
  },
  {
    table: "decisions",
    tsColumn: "created_at",
    select: "id, kind, platform, ref, status, created_at, resolved_at",
    map: mapDecision,
  },
  {
    table: "vault_events",
    tsColumn: "created_at",
    select: "id, item_id, action, created_at",
    map: mapVaultEvent,
  },
  {
    table: "miniapp_gate_events",
    tsColumn: "created_at",
    select: "id, app_id, kind, ref, created_at",
    map: mapGateEvent,
  },
  {
    table: "creative_jobs",
    tsColumn: "created_at",
    select:
      "id, channel, mode, status, provider_request_id, created_at, delivered_at",
    map: mapCreativeJob,
  },
];

const PAGE = 1000;

/** An admin receipt carries the owning user alongside the stable columns. */
export interface AdminReceipt extends TraceReceipt {
  user_id: string | null;
}

interface CollectOptions {
  /** Omitted → every user's rows (operator reads only). */
  userId?: string | undefined;
  window: TraceWindow;
  limit: number;
  newestFirst: boolean;
  /** true → select and carry user_id on each row. */
  withUser: boolean;
}

async function collect(
  supabase: SupabaseClient,
  options: CollectOptions
): Promise<AdminReceipt[]> {
  const { userId, window, limit, newestFirst, withUser } = options;
  const receipts: AdminReceipt[] = [];
  for (const source of SOURCES) {
    let offset = 0;
    for (;;) {
      let query = supabase
        .from(source.table)
        .select(withUser ? `user_id, ${source.select}` : source.select);
      if (userId) query = query.eq("user_id", userId);
      query = query
        .order(source.tsColumn, { ascending: !newestFirst })
        .range(offset, offset + PAGE - 1);
      if (window.from) query = query.gte(source.tsColumn, window.from);
      if (window.to) query = query.lt(source.tsColumn, window.to);
      const { data, error } = await query;
      if (error) break; // a missing table (unapplied migration) exports as absent
      const values: unknown[] = Array.isArray(data) ? [...data] : [];
      const rows = values.filter(isRow);
      for (const row of rows) {
        receipts.push({
          ...source.map(row),
          user_id: withUser ? str(row.user_id) : null,
        });
      }
      if (rows.length < PAGE || receipts.length >= limit) break;
      offset += PAGE;
    }
  }
  receipts.sort((a, b) =>
    newestFirst
      ? String(b.ts ?? "").localeCompare(String(a.ts ?? ""))
      : String(a.ts ?? "").localeCompare(String(b.ts ?? ""))
  );
  return receipts.slice(0, limit);
}

export async function fetchReceipts(
  supabase: SupabaseClient,
  userId: string,
  window: TraceWindow = {},
  limit = 10_000,
  /** true → return the newest `limit` receipts, sorted newest-first. */
  newestFirst = false
): Promise<TraceReceipt[]> {
  return collect(supabase, {
    userId,
    window,
    limit,
    newestFirst,
    withUser: false,
  });
}

/**
 * Operator variant of `fetchReceipts`: one user when `userId` is given,
 * otherwise every user's receipts in the window, each row stamped with its
 * `user_id`. Still metadata only (C4) — same explicit select lists.
 */
export async function fetchAdminReceipts(
  supabase: SupabaseClient,
  userId: string | undefined,
  window: TraceWindow = {},
  limit = 10_000,
  newestFirst = false
): Promise<AdminReceipt[]> {
  return collect(supabase, {
    userId,
    window,
    limit,
    newestFirst,
    withUser: true,
  });
}

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvHeader(): string {
  return RECEIPT_COLUMNS.join(",");
}

export function toCsvRow(row: TraceReceipt): string {
  return RECEIPT_COLUMNS.map((column) => csvEscape(row[column])).join(",");
}

/** JSONL with keys in RECEIPT_COLUMNS order on every line (stable keys). */
export function toJsonlLine(row: TraceReceipt): string {
  const ordered: Record<string, string | number | null> = {};
  for (const column of RECEIPT_COLUMNS) ordered[column] = row[column];
  return JSON.stringify(ordered);
}

/** Operator exports prefix the stable columns with the owning user. */
export function adminCsvHeader(): string {
  return `user_id,${csvHeader()}`;
}

export function adminToCsvRow(row: AdminReceipt): string {
  return `${csvEscape(row.user_id)},${toCsvRow(row)}`;
}

export function adminToJsonlLine(row: AdminReceipt): string {
  const ordered: Record<string, string | number | null> = {
    user_id: row.user_id,
  };
  for (const column of RECEIPT_COLUMNS) ordered[column] = row[column];
  return JSON.stringify(ordered);
}
