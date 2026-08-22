/**
 * Operator trace receipts: GET /api/admin/traces?user_id=&from=&to=&format=
 *
 * The admin variant of the owner export at /api/me/traces/export. Without
 * `user_id` it spans every user, stamping each row with its owner; `format=csv`
 * or `format=jsonl` streams a download, and the default JSON response returns
 * the rows inline. Receipts are metadata by construction (C4) — no transcripts,
 * prompts, or message bodies are reachable from here at any format. The
 * optional W&B mirror (lib/traces/weave.ts) stays dormant without WANDB_API_KEY.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import {
  adminCsvHeader,
  adminToCsvRow,
  adminToJsonlLine,
  fetchAdminReceipts,
  type TraceWindow,
} from "@/lib/traces/receipts";
import { mirrorReceipts, weaveEnabled } from "@/lib/traces/weave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ISO_DATEISH = /^\d{4}-\d{2}-\d{2}(?:T[0-9:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 10_000;
const MAX_LIMIT = 50_000;

function parseWindow(request: NextRequest): TraceWindow | null {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (from && !ISO_DATEISH.test(from)) return null;
  if (to && !ISO_DATEISH.test(to)) return null;
  return { from: from ?? undefined, to: to ?? undefined };
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const format = params.get("format") ?? "json";
  if (format !== "json" && format !== "csv" && format !== "jsonl") {
    return NextResponse.json(
      { error: "format must be json, csv, or jsonl" },
      { status: 400 }
    );
  }
  const window = parseWindow(request);
  if (!window) {
    return NextResponse.json(
      { error: "from/to must be ISO dates" },
      { status: 400 }
    );
  }
  const userId = params.get("user_id") ?? undefined;
  if (userId && !UUID.test(userId)) {
    return NextResponse.json({ error: "user_id must be a uuid" }, { status: 400 });
  }
  const limitParam = params.get("limit");
  const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `limit must be an integer 1-${MAX_LIMIT}` },
      { status: 400 }
    );
  }

  const supabase = serviceClient();
  const receipts = await fetchAdminReceipts(
    supabase,
    userId,
    window,
    limit,
    format === "json"
  );
  if (weaveEnabled()) {
    // fire-and-forget metadata mirror; never blocks or fails the read
    void mirrorReceipts(receipts);
  }

  if (format === "json") {
    return NextResponse.json({
      user_id: userId ?? null,
      count: receipts.length,
      receipts,
    });
  }

  const day = new Date().toISOString().slice(0, 10);
  const lines =
    format === "csv"
      ? [adminCsvHeader(), ...receipts.map(adminToCsvRow)]
      : receipts.map(adminToJsonlLine);
  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type":
        format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson",
      "Content-Disposition": `attachment; filename="air-admin-traces-${day}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
