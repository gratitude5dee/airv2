/**
 * MA9.3 — GET /api/me/traces/export?format=csv|jsonl&from=&to=&include=transcripts
 *
 * Streams the owner's receipts (agent_runs, decisions, vault_events,
 * miniapp_gate_events, creative_jobs) as a download. Receipts are metadata
 * only; `include=transcripts` (jsonl only) additionally streams the owner's
 * session transcripts from their own box via the existing allowlisted Hermes
 * session paths — box → response, never Postgres, never logs. The optional
 * W&B mirror receives receipt metadata only and is dormant without
 * WANDB_API_KEY.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { serviceClient } from "@/lib/supabase";
import {
  csvHeader,
  fetchReceipts,
  toCsvRow,
  toJsonlLine,
  type TraceWindow,
} from "@/lib/traces/receipts";
import { transcriptLines } from "@/lib/traces/transcripts";
import { mirrorReceipts, weaveEnabled } from "@/lib/traces/weave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ISO_DATEISH = /^\d{4}-\d{2}-\d{2}(?:T[0-9:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function parseWindow(request: NextRequest): TraceWindow | null {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (from && !ISO_DATEISH.test(from)) return null;
  if (to && !ISO_DATEISH.test(to)) return null;
  return { from: from ?? undefined, to: to ?? undefined };
}

export async function GET(request: NextRequest): Promise<Response> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const format = params.get("format") ?? "jsonl";
  if (format !== "csv" && format !== "jsonl") {
    return NextResponse.json(
      { error: "format must be csv or jsonl" },
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
  const includeTranscripts = params.get("include") === "transcripts";
  if (includeTranscripts && format !== "jsonl") {
    return NextResponse.json(
      { error: "include=transcripts requires format=jsonl" },
      { status: 400 }
    );
  }

  const supabase = serviceClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!user) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const receipts = await fetchReceipts(supabase, userId, window);
  if (weaveEnabled()) {
    // metadata mirror after the response is sent; never blocks or fails
    // the download (a bare fire-and-forget promise gets dropped when the
    // serverless function is frozen after responding)
    after(() => mirrorReceipts(receipts));
  }

  const day = new Date().toISOString().slice(0, 10);
  const headers = {
    "Content-Type":
      format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson",
    "Content-Disposition": `attachment; filename="air-traces-${day}.${format}"`,
    "Cache-Control": "no-store",
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (format === "csv") {
          controller.enqueue(encoder.encode(`${csvHeader()}\n`));
          for (const row of receipts) {
            controller.enqueue(encoder.encode(`${toCsvRow(row)}\n`));
          }
        } else {
          for (const row of receipts) {
            controller.enqueue(encoder.encode(`${toJsonlLine(row)}\n`));
          }
          if (includeTranscripts) {
            const box = await ensureBoxAwake(supabase, userId);
            try {
              for await (const line of transcriptLines(box.target, window)) {
                controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
              }
            } finally {
              await armStopAfter(supabase, userId).catch(() => undefined);
            }
          }
        }
        controller.close();
      } catch (error) {
        const message =
          error instanceof StartLimitError
            ? "box busy starting — transcripts unavailable, retry in a minute"
            : "transcripts unavailable";
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ kind: "error", message })}\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
