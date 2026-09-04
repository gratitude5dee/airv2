/**
 * V11 §9.2 / §14.1 `POST /api/create/turn` — one Create turn from the web
 * surface. The owner (store session on the mini origin) sends a prompt for
 * one app; the control plane ensures the app exists as the owner's draft,
 * ensures the Box session `air-create-<appname>`, and creates a Hermes run
 * with `model: "create-<tier>"` (a tier name — the Box never sees a slug,
 * C2), the generated Create system prompt plus project context, and the
 * run metadata the gateway attributes usage by. Returns the run id; the
 * browser streams it from `GET /api/create/events/[runId]`.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import {
  PublishError,
  publisherUsername,
  slugFor,
  validateAppName,
} from "@/lib/miniapps/publish";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { CREATE_SESSION_RE, startCreateTurn } from "@/lib/create/turn";
import { budgetExhausted, projectBudget } from "@/lib/create/budget";
import { createTurnRateLimited, recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    appname?: unknown;
    input?: unknown;
    tier?: unknown;
    session?: unknown;
  } | null;
  if (body?.session !== undefined) {
    if (typeof body.session !== "string" || !CREATE_SESSION_RE.test(body.session)) {
      return NextResponse.json({ error: "bad session" }, { status: 400 });
    }
  }
  const supabase = serviceClient();
  try {
    const appname = validateAppName(typeof body?.appname === "string" ? body.appname : "");
    if (typeof body?.session === "string" && body.session !== `air-create-${appname}`) {
      return NextResponse.json({ error: "bad session" }, { status: 400 });
    }
    if (await createTurnRateLimited(supabase, userId)) {
      return NextResponse.json({ error: "too many turns" }, { status: 429 });
    }
    // A spent project refuses new turns up front (the gateway would refuse
    // the first completion anyway); the owner raises it on the surface.
    const slug = slugFor(await publisherUsername(supabase, userId), appname);
    const budget = await projectBudget(supabase, userId, slug);
    if (budget && budgetExhausted(budget)) {
      return NextResponse.json(
        { error: "insufficient_quota", reason: "create_budget", budget },
        { status: 429 }
      );
    }
    const turn = await startCreateTurn(
      supabase,
      userId,
      {
        appname,
        input: body?.input,
        tier: typeof body?.tier === "string" ? body.tier : undefined,
        trigger: "web",
      },
      { budget }
    );
    await recordOpsEvent(supabase, "create.turn", userId, `${turn.slug}:${turn.tier}`);
    return NextResponse.json({
      run_id: turn.run_id,
      session: turn.session,
      slug: turn.slug,
      appname: turn.appname,
      tier: turn.tier,
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    console.error(
      JSON.stringify({
        msg: "create turn failed",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return NextResponse.json({ error: "run failed" }, { status: 500 });
  }
}
