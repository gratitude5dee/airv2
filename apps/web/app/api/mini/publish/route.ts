/**
 * MA3 Publish surface API (store-session auth, mini origin):
 *  GET   — my apps + earnings (x402_receipts; Stripe joins after Session B).
 *  POST  — stage a draft registry row (<username>-<appname> slug).
 *  PATCH — owner-scoped gate settings (access, x402, password, plugin
 *          sign-in). Ownership comes from the verified store session, never
 *          the body; payouts always route to users.wallet_address.
 * The status flip and bundle upload live in their own routes below this one.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import {
  createDraft,
  PublishError,
  publisherEarnings,
  updateGateSettings,
  type GateSettingsInput,
} from "@/lib/miniapps/publish";
import { publishRateLimited, recordOpsEvent } from "@/lib/security/limits";

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
    .select(
      "slug, name, description, status, visibility, bundle_version, draft_version, " +
        "agent_identity, access, x402_enabled, x402_price_usdc, " +
        "plugin_signin_enabled, password_hash"
    )
    .eq("owner_user_id", userId)
    .order("slug");
  const earnings = await publisherEarnings(supabase, userId);
  // The creator previews the <username>-<appname> slug before staging.
  const { data: user } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  // Never return the hash itself — the page only needs "is one set".
  const rows = ((apps ?? []) as unknown as Array<
    Record<string, unknown> & { password_hash: string | null }
  >).map(({ password_hash, ...rest }) => ({
    ...rest,
    has_password: password_hash !== null,
  }));
  return NextResponse.json({
    apps: rows,
    earnings,
    username: (user?.username as string | null) ?? null,
  });
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

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    slug?: unknown;
    access?: unknown;
    x402_enabled?: unknown;
    x402_price_usdc?: unknown;
    password?: unknown;
    plugin_signin_enabled?: unknown;
  } | null;
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const input: GateSettingsInput = {};
  if (body && "access" in body) {
    if (body.access !== "single" && body.access !== "multiplayer") {
      return NextResponse.json({ error: "invalid access" }, { status: 400 });
    }
    input.access = body.access;
  }
  if (body && "x402_enabled" in body) {
    if (typeof body.x402_enabled !== "boolean") {
      return NextResponse.json(
        { error: "invalid x402_enabled" },
        { status: 400 }
      );
    }
    input.x402Enabled = body.x402_enabled;
  }
  if (body && "x402_price_usdc" in body) {
    if (body.x402_price_usdc !== null && typeof body.x402_price_usdc !== "number") {
      return NextResponse.json(
        { error: "invalid x402_price_usdc" },
        { status: 400 }
      );
    }
    input.x402PriceUsdc = body.x402_price_usdc;
  }
  if (body && "password" in body) {
    if (body.password !== null && typeof body.password !== "string") {
      return NextResponse.json({ error: "invalid password" }, { status: 400 });
    }
    input.password = body.password;
  }
  if (body && "plugin_signin_enabled" in body) {
    if (typeof body.plugin_signin_enabled !== "boolean") {
      return NextResponse.json(
        { error: "invalid plugin_signin_enabled" },
        { status: 400 }
      );
    }
    input.pluginSigninEnabled = body.plugin_signin_enabled;
  }
  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = serviceClient();
  if (await publishRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many changes" }, { status: 429 });
  }
  try {
    await updateGateSettings(supabase, userId, slug, input);
    await recordOpsEvent(supabase, "publish", userId, `gates:${slug}`);
    return NextResponse.json({ ok: true });
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
