/**
 * `/trade` command grammar (docs/trade/plan.md §4). Only the first token
 * after the command is parsed deterministically — everything else is a
 * natural-language agent turn (order sizing and product resolution are the
 * agent's job via /api/trade tools, never regex). Deterministic arms are
 * answered without a model call.
 */

export type TradeCommand =
  | { kind: "card" }
  | { kind: "help" }
  | { kind: "mode"; mode: "paper" | "live" | "connect" }
  | { kind: "portfolio" }
  | { kind: "orders"; scope: "open" | "recent" }
  | { kind: "cancel"; ref: string }
  | { kind: "watch"; symbol: string; op: ">" | "<"; price: string }
  | { kind: "unwatch"; symbol: string }
  | { kind: "agent"; text: string };

const HEAD = /^\/trade(?:\s+(.*))?$/is;
const DECIMAL = /^\d+(?:\.\d+)?$/;
const SYMBOL = /^[a-z0-9]{1,12}$/i;
const WATCH_RE = /^\$?([a-z0-9]{1,12})\s*(>|<|above|below|over|under)\s*\$?([\d,]+(?:\.\d+)?)$/i;

export const TRADE_HELP_LINES = [
  "/trade — open your trading mini-app",
  "/trade buy $50 of BTC — preview, then you approve",
  "/trade portfolio — holdings and available cash",
  "/trade orders — open and recent orders",
  "/trade cancel last — cancel an open order (approval required)",
  "/trade watch SOL > 200 — price alert",
  "/trade connect — link your Coinbase key",
  "/trade paper | /trade live — switch modes",
] as const;

export const TRADE_HELP = TRADE_HELP_LINES.join("\n");

function normSymbol(raw: string): string | null {
  const cleaned = raw.trim().replace(/^\$/, "").toUpperCase();
  return SYMBOL.test(cleaned) ? cleaned : null;
}

export function parseTradeCommand(input: string): TradeCommand | null {
  const match = HEAD.exec(input.trim());
  if (!match) return null;
  const rest = (match[1] ?? "").trim();
  if (!rest) return { kind: "card" };
  const [head = "", ...tail] = rest.split(/\s+/);
  const verb = head.toLowerCase();

  if (verb === "help" && tail.length === 0) return { kind: "help" };
  if (verb === "connect") return { kind: "mode", mode: "connect" };
  if ((verb === "paper" || verb === "live") && tail.length === 0) {
    return { kind: "mode", mode: verb };
  }
  if (
    (verb === "portfolio" || verb === "balance" || verb === "positions") &&
    tail.length === 0
  ) {
    return { kind: "portfolio" };
  }
  if (verb === "orders" || verb === "fills") {
    const scope = tail[0]?.toLowerCase();
    return { kind: "orders", scope: scope === "open" ? "open" : "recent" };
  }
  if (verb === "cancel" && tail.length > 0) {
    return { kind: "cancel", ref: tail.join(" ").slice(0, 64) };
  }
  if (verb === "watch") {
    const m = WATCH_RE.exec(tail.join(" "));
    if (m) {
      const symbol = normSymbol(m[1] ?? "");
      const price = (m[3] ?? "").replace(/,/g, "");
      if (symbol && DECIMAL.test(price)) {
        const raw = (m[2] ?? "").toLowerCase();
        return {
          kind: "watch",
          symbol,
          op: raw === ">" || raw === "above" || raw === "over" ? ">" : "<",
          price,
        };
      }
    }
    return { kind: "agent", text: rest };
  }
  if (verb === "unwatch" && tail.length > 0) {
    const symbol = normSymbol(tail[0] ?? "");
    return symbol
      ? { kind: "unwatch", symbol }
      : { kind: "agent", text: rest };
  }
  return { kind: "agent", text: rest };
}
