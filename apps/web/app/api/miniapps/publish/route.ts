/**
 * MA3 miniapp_publish backing tool (gateway-token auth, same pattern as
 * /api/browser/social). The agent can STAGE: create/refresh a draft registry
 * row and file a miniapp_publish Needs-you decision. It can never flip
 * status — that update exists only behind the owner's store session
 * (/api/mini/publish/status). Approving the decision points the owner at
 * the Publish surface where the flip happens under their session.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { createDraft, PublishError } from "@/lib/miniapps/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function boxUserId(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  return box ? (box.user_id as string) : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    appname?: unknown;
    name?: unknown;
    description?: unknown;
    agentIdentity?: unknown;
  } | null;
  try {
    const app = await createDraft(supabase, userId, {
      appname: typeof body?.appname === "string" ? body.appname : "",
      name: typeof body?.name === "string" ? body.name : "",
      description: typeof body?.description === "string" ? body.description : "",
      agentIdentity:
        typeof body?.agentIdentity === "string" ? body.agentIdentity : null,
    });
    const { data: decision, error } = await supabase
      .from("decisions")
      .insert({
        user_id: userId,
        kind: "miniapp_publish",
        ref: app.slug,
        label: `Publish ${app.name} to the store`,
      })
      .select("id")
      .single();
    if (error || !decision) {
      return NextResponse.json({ error: "decision failed" }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      slug: app.slug,
      status: "draft",
      decision_id: decision.id,
      note: "Draft staged. Publishing is an owner decision in Needs-you / the Publish page.",
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
