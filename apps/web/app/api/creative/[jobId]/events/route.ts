/**
 * M16 web creative lane SSE: streams one creative job's lifecycle to the
 * browser — routing → generating → terminal done/failed/refused. The browser
 * only ever receives a short-TTL signed delivery URL; provider URLs, keys,
 * and prompts never appear in any event (C3/C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { SSE_HEADERS } from "@/lib/chat/relay";
import { getCreativeJob, type CreativeJobStatus } from "@/lib/creative/jobs";
import { signedDeliveryForJob } from "@/lib/creative/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const POLL_MS = 1_000;
const MAX_STREAM_MS = 480_000;

const phaseFor = (status: CreativeJobStatus): "routing" | "generating" =>
  status === "routing" ? "routing" : "generating";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { jobId } = await context.params;
  if (!/^[A-Za-z0-9-]+$/.test(jobId)) {
    return NextResponse.json({ error: "bad job id" }, { status: 400 });
  }
  const supabase = serviceClient();
  const job = await getCreativeJob(supabase, userId, jobId);
  if (!job) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Default-event frames (JSON with an `event` field) so the browser's
      // EventSource.onmessage handles them like the chat relay's frames.
      const send = (event: string, data: Record<string, unknown>): void => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event, ...data })}\n\n`)
        );
      };
      const deadline = Date.now() + MAX_STREAM_MS;
      let lastPhase: string | undefined;
      try {
        while (Date.now() < deadline) {
          const current = await getCreativeJob(supabase, userId, jobId);
          if (!current) {
            send("creative.failed", { line: "that one didn't come out." });
            break;
          }
          if (current.status === "delivered") {
            const delivery = await signedDeliveryForJob(supabase, userId, jobId);
            if (!delivery) {
              send("creative.failed", { line: "that one didn't come out." });
              break;
            }
            const kind = ["mp4", "mov"].includes(delivery.ext)
              ? "video"
              : "image";
            send("creative.done", { kind, url: delivery.url });
            break;
          }
          if (current.status === "refused") {
            send("creative.refused", {
              line: current.error ?? "can't make that one.",
            });
            break;
          }
          if (
            current.status === "failed" ||
            current.status === "submit_unknown"
          ) {
            send("creative.failed", {
              line: current.error ?? "that one didn't come out.",
            });
            break;
          }
          const phase = phaseFor(current.status);
          if (phase !== lastPhase) {
            lastPhase = phase;
            send("creative.status", { phase });
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }
      } catch {
        // Client disconnects surface as enqueue errors; nothing to clean up.
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
