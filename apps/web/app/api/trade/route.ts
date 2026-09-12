/**
 * Trade box API (docs/trade/plan.md §7.2). Authenticated by the box's
 * gateway token — same pattern as /api/miniapps/commerce. Every arm is
 * read-only or stages a `pending` decision; no route here ever calls a
 * venue mutating endpoint (T1). The owner session may also call it (the
 * mini-app module prefers direct service calls, but the route stays
 * consistent for /home and future surfaces).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import {
  listTradeOrders,
  portfolioView,
  proposeTrade,
  proposeTradeCancel,
  previewTrade,
  venueFor,
} from "@/lib/trade/service";
import { TradeError } from "@/lib/trade/order";
import {
  addWatch,
  listWatches,
  removeWatch,
} from "@/lib/trade/watch";
import { deliverTradeApproval } from "@/lib/trade/imessage";
import { TradeVenueError } from "@/lib/trade/venue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function callerUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token) {
    const { data: box } = await serviceClient()
      .from("boxes")
      .select("user_id")
      .eq("gateway_token", token)
      .maybeSingle();
    if (box && typeof box.user_id === "string") return box.user_id;
  }
  return (await sessionUserId(request)) ?? null;
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof TradeError || error instanceof TradeVenueError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error(
    JSON.stringify({
      msg: "trade api failed",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return NextResponse.json({ error: "trade failed" }, { status: 502 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await callerUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const resource = request.nextUrl.searchParams.get("resource") ?? "balance";
  try {
    if (resource === "balance") {
      return NextResponse.json(await portfolioView(supabase, userId));
    }
    if (resource === "orders") {
      const scope =
        request.nextUrl.searchParams.get("scope") === "open" ? "open" : "recent";
      return NextResponse.json({
        orders: await listTradeOrders(supabase, userId, scope),
      });
    }
    if (resource === "products") {
      const q = request.nextUrl.searchParams.get("q") ?? "";
      const { venue } = await venueFor(supabase, userId);
      return NextResponse.json({ products: await venue.listProducts(q, 50) });
    }
    if (resource === "watch") {
      return NextResponse.json({ items: await listWatches(supabase, userId) });
    }
    return NextResponse.json({ error: "unknown resource" }, { status: 400 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await callerUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    order?: unknown;
    previewToken?: unknown;
    note?: unknown;
    ref?: unknown;
    symbol?: unknown;
    op?: unknown;
    price?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";
  try {
    if (action === "preview") {
      return NextResponse.json(
        await previewTrade(supabase, userId, body?.order, "agent"),
      );
    }
    if (action === "propose") {
      const result = await proposeTrade(supabase, userId, {
        order: body?.order,
        previewToken: body?.previewToken,
        note: body?.note,
      });
      await deliverTradeApproval(supabase, userId, result.decisionId, result.summary);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "cancel") {
      const result = await proposeTradeCancel(
        supabase,
        userId,
        typeof body?.ref === "string" ? body.ref : "",
      );
      await deliverTradeApproval(supabase, userId, result.decisionId, result.label);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "watch") {
      return NextResponse.json(
        await addWatch(supabase, userId, {
          symbol: body?.symbol,
          op: body?.op,
          price: body?.price,
        }),
      );
    }
    if (action === "unwatch") {
      return NextResponse.json(
        await removeWatch(supabase, userId, body?.symbol),
      );
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
