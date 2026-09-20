import { after, NextRequest, NextResponse } from "next/server";
import { hasMuseWorkerToken, museEnabled } from "@/lib/muse/auth";
import {
  isMuseCapability,
  MuseCapabilityError,
  observeMuseRun,
  runMuseCapability,
} from "@/lib/muse/capabilities";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Private Worker → control-plane capability router. The OAuth token and API
 * key are authenticated at the Worker; this endpoint receives only the
 * opaque user id and bounded tool input, and it never logs that input.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ capability: string }> },
): Promise<NextResponse> {
  if (!museEnabled() || !hasMuseWorkerToken(request)) return new NextResponse(null, { status: 404 });
  const { capability } = await context.params;
  if (!isMuseCapability(capability)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { user_id?: unknown; input?: unknown } | null;
  if (!body || typeof body.user_id !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const result = await runMuseCapability(serviceClient(), body.user_id, capability, body.input ?? {});
    // The caller can synchronously wait for up to eight seconds. Give a
    // still-running Box a short server-side observation window afterwards so
    // its durable metadata receipt eventually reaches terminal state without
    // relaying the run's text to the Worker or database.
    if (capability === "run" && result["status"] === "running" && typeof result["run_id"] === "string") {
      const userId = body.user_id;
      const runId = result["run_id"];
      after(() => observeMuseRun(serviceClient(), userId, runId, 14).catch(() => undefined));
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MuseCapabilityError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "air_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
