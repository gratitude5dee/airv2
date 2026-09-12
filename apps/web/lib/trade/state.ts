/**
 * Trade's box documents (C4 — plan §6.2): `.hermes/miniapps/trade/` holds the
 * watchlist, the paper ledger, and the last portfolio snapshot, so the agent
 * and the mini-app view read and write the same files (MA10). Postgres holds
 * routing and the order ledger only — never a holdings mirror.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { BoxApiError, readFile } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { withStateLease } from "../miniapps/stateLease";
import { writeAppStateTo } from "../miniapps/store";

export interface TradeWatchlistItem {
  symbol: string;
  productId: string;
  op: ">" | "<";
  price: string;
  /** firing = crossed + persisted, alert delivery in flight (retried). */
  state: "armed" | "firing" | "fired";
  firedAt?: string;
  /** Price at the moment of the cross — reused across delivery retries. */
  hitPrice?: string;
  sendAttempts?: number;
}

export interface TradeWatchlistDoc {
  version: 1;
  items: TradeWatchlistItem[];
}

export interface TradePaperFill {
  at: string;
  orderId: string;
  productId: string;
  side: "BUY" | "SELL";
  qty: string;
  price: string;
  valueUsd: string;
  feeUsd: string;
}

export interface TradePaperDoc {
  version: 1;
  cashUsd: number;
  positions: Record<string, { qty: number; avgCost: number }>;
  ledger: TradePaperFill[];
}

export interface TradeSnapshot {
  version: 1;
  at: string;
  mode: "paper" | "live";
  totalUsd: number;
  cashUsd: number;
  holdings: { asset: string; qty: string; priceUsd: string | null; valueUsd: number }[];
  /** Hourly points, last 7 days — the Portfolio sparkline. */
  history: { at: string; totalUsd: number }[];
}

export const PAPER_STARTING_USD = 10_000;
const PAPER_LEDGER_MAX = 500;
const WATCHLIST_MAX = 50;

function docPath(resource: string): string {
  return `.hermes/miniapps/trade/${resource}.json`;
}

export const EMPTY_PAPER_DOC: TradePaperDoc = {
  version: 1,
  cashUsd: PAPER_STARTING_USD,
  positions: {},
  ledger: [],
};

export const EMPTY_WATCHLIST: TradeWatchlistDoc = { version: 1, items: [] };

async function readDoc<T>(boxId: string, resource: string, fallback: T): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(boxId, docPath(resource));
  } catch (error) {
    if (error instanceof BoxApiError && error.status === 404) {
      return structuredClone(fallback);
    }
    throw error;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    if (parsed === null || typeof parsed !== "object") {
      throw new Error("not an object");
    }
    return parsed;
  } catch (error) {
    // Fail closed: only a 404 means "uninitialized" — a truncated or corrupt
    // doc must never be overwritten with defaults by the next mutation.
    throw new Error(`trade ${resource} document is malformed`, { cause: error });
  }
}

/** Read a trade document; wakes the box (same as every mini-app render). */
export async function readTradeDoc<T>(
  supabase: SupabaseClient,
  userId: string,
  resource: "paper" | "watchlist" | "snapshot",
  fallback: T,
): Promise<T> {
  const box = await ensureBoxAwake(supabase, userId);
  return readDoc(box.boxId, resource, fallback);
}

/**
 * Lease-serialized read-modify-write. `mutate` returns the document to
 * persist (it may be a normalized replacement — what it returns is what gets
 * written), or false to skip the write.
 */
export async function mutateTradeDoc<T>(
  supabase: SupabaseClient,
  userId: string,
  resource: "paper" | "watchlist" | "snapshot",
  fallback: T,
  mutate: (doc: T) => T | false,
): Promise<T> {
  return withStateLease(supabase, userId, "trade", resource, { attempts: 3 }, async (boxId, renew) => {
    const doc = await readDoc(boxId, resource, fallback);
    const next = mutate(doc);
    if (next !== false) {
      await renew();
      await writeAppStateTo(boxId, "trade", resource, next);
      return next;
    }
    return doc;
  });
}

/** Watchlist mutation on an already-awake box (the cron tick passes boxId). */
export async function readTradeDocFrom<T>(
  boxId: string,
  resource: "paper" | "watchlist" | "snapshot",
  fallback: T,
): Promise<T> {
  return readDoc(boxId, resource, fallback);
}

export async function writeTradeDocTo<T>(
  boxId: string,
  resource: "paper" | "watchlist" | "snapshot",
  doc: T,
): Promise<void> {
  await writeAppStateTo(boxId, "trade", resource, doc);
}

export function normalizeWatchlist(doc: TradeWatchlistDoc): TradeWatchlistDoc {
  const items = Array.isArray(doc?.items) ? doc.items : [];
  return {
    version: 1,
    items: items
      .filter(
        (item) =>
          item &&
          typeof item.symbol === "string" &&
          typeof item.productId === "string" &&
          (item.op === ">" || item.op === "<") &&
          typeof item.price === "string",
      )
      .slice(0, WATCHLIST_MAX),
  };
}

export function normalizePaperDoc(doc: TradePaperDoc): TradePaperDoc {
  const ledger = Array.isArray(doc?.ledger) ? doc.ledger.slice(-PAPER_LEDGER_MAX) : [];
  const positions =
    typeof doc?.positions === "object" && doc.positions !== null ? doc.positions : {};
  const cleaned: TradePaperDoc["positions"] = {};
  for (const [asset, position] of Object.entries(positions)) {
    if (
      position &&
      typeof position.qty === "number" &&
      Number.isFinite(position.qty) &&
      position.qty > 0 &&
      typeof position.avgCost === "number" &&
      Number.isFinite(position.avgCost)
    ) {
      cleaned[asset.toUpperCase()] = position;
    }
  }
  return {
    version: 1,
    cashUsd:
      typeof doc?.cashUsd === "number" && Number.isFinite(doc.cashUsd)
        ? doc.cashUsd
        : PAPER_STARTING_USD,
    positions: cleaned,
    ledger,
  };
}

/** Snapshot writes never pay for a box wake — skip when the box is down. */
export async function writeSnapshotIfBoxAwake(
  supabase: SupabaseClient,
  userId: string,
  snapshot: TradeSnapshot,
): Promise<void> {
  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id, state")
    .eq("user_id", userId)
    .maybeSingle();
  if (!box || (box.state !== "ready" && box.state !== "idle")) return;
  await writeAppStateTo(box.provider_box_id as string, "trade", "snapshot", snapshot);
}

export async function readSnapshotIfBoxAwake(
  supabase: SupabaseClient,
  userId: string,
): Promise<TradeSnapshot | null> {
  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id, state")
    .eq("user_id", userId)
    .maybeSingle();
  if (!box || (box.state !== "ready" && box.state !== "idle")) return null;
  return readDoc<TradeSnapshot | null>(box.provider_box_id as string, "snapshot", null);
}
