/**
 * MA3 Publish surface API (store-session auth, mini origin):
 *  GET  — my apps + earnings (x402_receipts; Stripe joins after Session B).
 *  POST — stage a draft registry row (<username>-<appname> slug).
 * The status flip and bundle upload live in their own routes below this one.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import {
  createDraft,
  PublishError,
  publisherEarnings,
} from "@/lib/miniapps/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data: apps } = await supabase
    .from("mini_apps")
    .select("slug, name, description, status, visibility, bundle_version, agent_identity")
    .eq("owner_user_id", userId)
    .order("slug");
  const earnings = await publisherEarnings(supabase, userId);
  return NextResponse.json({ apps: apps ?? [], earnings });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
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
    const app = await createDraft(serviceClient(), userId, {
      appname: typeof body?.appname === "string" ? body.appname : "",
      name: typeof body?.name === "string" ? body.name : "",
      description: typeof body?.description === "string" ? body.description : "",
      agentIdentity:
        typeof body?.agentIdentity === "string" ? body.agentIdentity : null,
    });
    return NextResponse.json({ ok: true, slug: app.slug });
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
