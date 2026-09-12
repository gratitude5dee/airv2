/**
 * The iMessage `/trade` lane (docs/trade/plan.md §4.2): deterministic arms
 * answer without a model turn; everything else falls through to the normal
 * Hermes run so the box-side trade skill takes it. Owner-only end to end —
 * a non-owner sender gets the standard owner line, never a portfolio read.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mintApprovalUrl } from "../approvals/token";
import { createSpectrumSender } from "../spectrum/sender";
import { mintSignedLink, sendMiniAppCard } from "../miniapps/cards";
import { OWNER_ONLY_CARD_LINE } from "../miniapps/imessageCommand";
import {
  listTradeOrders,
  portfolioView,
  proposeTradeCancel,
  setTradeMode,
} from "./service";
import { TradeError } from "./order";
import { addWatch, removeWatch } from "./watch";
import { TradeVenueError } from "./venue";
import { TRADE_HELP, type TradeCommand } from "./parse";

interface TradeJob {
  userId: string;
  senderTier: number | null;
  /** iMessage destination for card sends — absent on the web lane, where
   *  card arms degrade to a text reply (the mini-app is reachable from /home
   *  anyway, and any filed approval still shows up in Needs you). */
  spaceId?: string;
  phone?: string;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function qty(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

/**
 * Deliver the approval surface for a filed trade decision: the Trade card
 * (opens to the Approve view), with the hosted approval rich link as the
 * transport fallback. Best-effort — the Needs-you queue is the durable one.
 */
export async function deliverTradeApproval(
  supabase: SupabaseClient,
  userId: string,
  decisionId: string,
  summary: string,
): Promise<void> {
  try {
    const { data: dest } = await supabase
      .from("imessage_destinations")
      .select("space_id, phone")
      .eq("user_id", userId)
      .maybeSingle();
    if (!dest?.space_id || !dest.phone) return;
    const spaceId = String(dest.space_id);
    const phone = String(dest.phone);
    try {
      await sendMiniAppCard(supabase, spaceId, phone, userId, "trade", "approve", {
        subcaption: summary,
        summary: `Trade — ${summary}`,
      });
    } catch {
      // Card transport failed — fall back to the hosted approval link.
      const sender = await createSpectrumSender().catch(() => null);
      if (!sender) return;
      try {
        await sender.sendRichLink(spaceId, phone, mintApprovalUrl(userId, decisionId));
      } catch {
        await sender
          .sendText(spaceId, phone, `${summary} — approve it in Needs you.`)
          .catch(() => undefined);
      } finally {
        await sender.close().catch(() => undefined);
      }
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "trade approval delivery failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

async function portfolioText(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const view = await portfolioView(supabase, userId);
  const lines = [
    `${view.mode === "paper" ? "Paper" : "Coinbase"} · ${money(view.totalUsd)} total${view.portfolioName ? ` · ${view.portfolioName}` : ""}`,
  ];
  for (const holding of view.balances.slice(0, 12)) {
    const value =
      holding.valueUsd !== null ? ` — ${money(holding.valueUsd)}` : "";
    lines.push(`${holding.asset}: ${qty(holding.qty)}${value}`);
  }
  if (view.balances.length === 0) lines.push("No balances yet.");
  return lines.join("\n");
}

async function ordersText(
  supabase: SupabaseClient,
  userId: string,
  scope: "open" | "recent",
): Promise<string> {
  const orders = await listTradeOrders(supabase, userId, scope);
  if (orders.length === 0) {
    return scope === "open" ? "No open orders." : "No recent orders.";
  }
  return orders
    .slice(0, 10)
    .map(
      (order) =>
        `${order.side} ${order.productId} ${order.sizeLabel} — ${order.status.toLowerCase()}`,
    )
    .join("\n");
}

export interface TradeLaneResult {
  handled: boolean;
}

/**
 * Returns {handled:true} when the message was answered by a deterministic
 * arm. `{handled:false}` hands it onward — `card` resolves through the
 * existing mini-app path, `agent` continues to the normal Hermes turn.
 */
export async function runTradeCommand(
  supabase: SupabaseClient,
  sendText: (text: string) => Promise<void>,
  job: TradeJob,
  command: TradeCommand,
): Promise<TradeLaneResult> {
  if (command.kind === "card" || command.kind === "agent") {
    return { handled: false };
  }
  if (job.senderTier !== 0) {
    await sendText(OWNER_ONLY_CARD_LINE);
    return { handled: true };
  }
  const reply = async (text: string): Promise<TradeLaneResult> => {
    await sendText(text);
    return { handled: true };
  };

  try {
    switch (command.kind) {
      case "help":
        return reply(TRADE_HELP);
      case "mode":
        if (command.mode === "connect") {
          if (job.spaceId && job.phone) {
            await sendMiniAppCard(
              supabase,
              job.spaceId,
              job.phone,
              job.userId,
              "trade",
              "settings",
              { subcaption: "Connect your Coinbase key" },
            );
            return { handled: true };
          }
          return reply(
            `Open Trade → Settings to connect your Coinbase key: ${mintSignedLink(job.userId, "trade", "settings")}`,
          );
        }
        await setTradeMode(supabase, job.userId, command.mode);
        return reply(
          command.mode === "paper"
            ? "Switched to paper trading — simulated fills, real prices."
            : "Switched to live — every order still needs your approval.",
        );
      case "portfolio":
        return reply(await portfolioText(supabase, job.userId));
      case "orders":
        return reply(await ordersText(supabase, job.userId, command.scope));
      case "cancel": {
        const result = await proposeTradeCancel(supabase, job.userId, command.ref);
        await deliverTradeApproval(supabase, job.userId, result.decisionId, result.label);
        return reply(`${result.label} — approve it in the Trade card or Needs you.`);
      }
      case "watch": {
        const { item } = await addWatch(supabase, job.userId, {
          symbol: command.symbol,
          op: command.op,
          price: command.price,
        });
        return reply(`Watching ${item.symbol} ${item.op} $${item.price}.`);
      }
      case "unwatch": {
        const { removed } = await removeWatch(supabase, job.userId, command.symbol);
        return reply(
          removed > 0 ? `Stopped watching ${command.symbol}.` : `No watch on ${command.symbol}.`,
        );
      }
    }
  } catch (error) {
    if (error instanceof TradeError || error instanceof TradeVenueError) {
      return reply(error.message);
    }
    throw error;
  }
}
