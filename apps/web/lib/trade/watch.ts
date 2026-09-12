/**
 * Price watches (docs/trade/plan.md §5.2 Watch tab + §7.2). The watchlist
 * lives in the box document (C4); armed items are ticked by /api/cron/trade
 * only for users whose box is already awake — waking a box just to poll a
 * price would be a wake-for-a-cache, and a stopped box simply pauses alerts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { coinbasePublicPrice } from "./coinbase";
import { TradeError } from "./order";
import {
  EMPTY_WATCHLIST,
  mutateTradeDoc,
  normalizeWatchlist,
  readTradeDoc,
  readTradeDocFrom,
  writeTradeDocTo,
  type TradeWatchlistItem,
} from "./state";
import { createSpectrumSender } from "../spectrum/sender";

export async function listWatches(
  supabase: SupabaseClient,
  userId: string,
): Promise<TradeWatchlistItem[]> {
  return normalizeWatchlist(
    await readTradeDoc(supabase, userId, "watchlist", EMPTY_WATCHLIST),
  ).items;
}

export async function addWatch(
  supabase: SupabaseClient,
  userId: string,
  input: { symbol?: unknown; op?: unknown; price?: unknown },
): Promise<{ item: TradeWatchlistItem }> {
  const symbol =
    typeof input.symbol === "string"
      ? input.symbol.trim().replace(/^\$/, "").toUpperCase()
      : "";
  const op = input.op === ">" || input.op === "<" ? input.op : null;
  const price =
    typeof input.price === "string"
      ? input.price.replace(/[$,\s]/g, "")
      : typeof input.price === "number"
        ? String(input.price)
        : "";
  if (!/^[A-Z0-9]{1,12}$/.test(symbol)) {
    throw new TradeError("Watch which asset? e.g. SOL", 400, "bad_symbol");
  }
  if (!op) {
    throw new TradeError("Watch above or below? e.g. SOL > 200", 400, "bad_op");
  }
  if (!/^\d+(\.\d+)?$/.test(price) || Number(price) <= 0) {
    throw new TradeError("A positive dollar price, e.g. SOL > 200", 400, "bad_price");
  }
  const productId = `${symbol}-USD`;
  const item: TradeWatchlistItem = {
    symbol,
    productId,
    op,
    price,
    state: "armed",
  };
  await mutateTradeDoc(supabase, userId, "watchlist", EMPTY_WATCHLIST, (docIn) => {
    const doc = normalizeWatchlist(docIn);
    const existing = doc.items.findIndex(
      (entry) =>
        entry.productId === productId && entry.op === op && entry.state === "armed",
    );
    if (existing >= 0) {
      doc.items[existing] = item;
    } else {
      doc.items.push(item);
    }
    return true;
  });
  return { item };
}

export async function removeWatch(
  supabase: SupabaseClient,
  userId: string,
  symbol: unknown,
): Promise<{ removed: number }> {
  const sym =
    typeof symbol === "string"
      ? symbol.trim().replace(/^\$/, "").toUpperCase()
      : "";
  let removed = 0;
  await mutateTradeDoc(supabase, userId, "watchlist", EMPTY_WATCHLIST, (docIn) => {
    const doc = normalizeWatchlist(docIn);
    const before = doc.items.length;
    doc.items = doc.items.filter((item) => item.symbol !== sym);
    removed = before - doc.items.length;
    return removed > 0;
  });
  return { removed };
}

/** Cron tick: fire armed watches on awake boxes; deliver via iMessage. */
export async function tickWatchlists(supabase: SupabaseClient): Promise<number> {
  const { data: awake } = await supabase
    .from("boxes")
    .select("user_id, provider_box_id")
    .in("state", ["ready", "idle"]);
  let fired = 0;
  for (const box of awake ?? []) {
    const userId = box.user_id as string;
    const boxId = box.provider_box_id as string;
    const doc = normalizeWatchlist(
      await readTradeDocFrom(boxId, "watchlist", EMPTY_WATCHLIST).catch(
        () => EMPTY_WATCHLIST,
      ),
    );
    const armed = doc.items.filter((item) => item.state === "armed");
    if (armed.length === 0) continue;

    const prices = new Map<string, number>();
    const products = [...new Set(armed.map((item) => item.productId))];
    for (const productId of products) {
      const price = await coinbasePublicPrice(productId).catch(() => null);
      const parsed = price ? Number(price) : NaN;
      if (Number.isFinite(parsed)) prices.set(productId, parsed);
    }
    if (prices.size === 0) continue;

    let changed = false;
    const hits: { item: TradeWatchlistItem; last: number }[] = [];
    for (const item of doc.items) {
      if (item.state !== "armed") continue;
      const last = prices.get(item.productId);
      if (last === undefined) continue;
      const crossed =
        item.op === ">" ? last >= Number(item.price) : last <= Number(item.price);
      if (crossed) {
        item.state = "fired";
        item.firedAt = new Date().toISOString();
        hits.push({ item, last });
        changed = true;
        fired += 1;
      }
    }
    if (!changed) continue;
    await writeTradeDocTo(boxId, "watchlist", doc).catch(() => undefined);

    const { data: dest } = await supabase
      .from("imessage_destinations")
      .select("space_id, phone")
      .eq("user_id", userId)
      .maybeSingle();
    if (!dest?.space_id || !dest.phone) continue;
    const sender = await createSpectrumSender().catch(() => null);
    if (!sender) continue;
    try {
      for (const hit of hits) {
        await sender
          .sendText(
            dest.space_id as string,
            dest.phone as string,
            `⏰ ${hit.item.symbol} ${hit.item.op} $${hit.item.price} — it's at $${hit.last} now.`,
          )
          .catch(() => undefined);
      }
    } finally {
      await sender.close().catch(() => undefined);
    }
  }
  return fired;
}
