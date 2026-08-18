/**
 * Connectors (M7): discovery, connect, and status — all server-side. The
 * browser sees toolkit names and connection statuses; Composio credentials
 * and the per-user MCP endpoint never reach it.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import {
  ComposioApiError,
  createLinkSession,
  deleteConnectedAccount,
  listConnectedAccounts,
  listToolkits,
} from "@/lib/composio/client";
import { connectionHealth } from "@/lib/connectors/meta";
import {
  ensureComposioSession,
  installComposioMcp,
} from "@/lib/provisioning/connectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const [toolkits, { data: rows }] = await Promise.all([
    listToolkits(),
    supabase
      .from("connections")
      .select("toolkit, status, connected_at")
      .eq("user_id", userId),
  ]);
  const connections = (rows ?? []) as Array<{
    toolkit: string;
    status: string;
    connected_at: string | null;
  }>;
  const health = await connectionHealth(supabase, userId, connections);
  return NextResponse.json({
    toolkits: toolkits.map((t) => ({
      slug: t.slug,
      name: t.name,
      logo: t.meta?.logo ?? null,
    })),
    connections,
    health,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    toolkit?: string;
  };
  const toolkit = body.toolkit?.toLowerCase();
  if (!toolkit || !/^[a-z0-9_-]{1,64}$/.test(toolkit)) {
    return NextResponse.json({ error: "invalid toolkit" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { sessionId } = await ensureComposioSession(supabase, userId);
  const link = await createLinkSession(
    sessionId,
    toolkit,
    `${env.appOrigin()}/home`
  );
  await supabase.from("connections").upsert(
    {
      user_id: userId,
      provider: "composio",
      toolkit,
      external_account_id: link.connected_account_id,
      status: "pending",
    },
    { onConflict: "user_id,provider,toolkit" }
  );
  return NextResponse.json({ redirect_url: link.redirect_url });
}

/** Sync statuses from Composio; install the MCP endpoint on first active. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const [accounts, { data: rows }] = await Promise.all([
    listConnectedAccounts(userId),
    supabase
      .from("connections")
      .select("id, toolkit, status")
      .eq("user_id", userId),
  ]);
  const activeByToolkit = new Map(
    accounts
      .filter((a) => a.toolkit?.slug)
      .map((a) => [a.toolkit?.slug as string, a.id])
  );
  let newlyActive = false;
  for (const row of rows ?? []) {
    const accountId = activeByToolkit.get(row.toolkit as string);
    if (accountId && row.status !== "active") {
      newlyActive = true;
      await supabase
        .from("connections")
        .update({
          status: "active",
          external_account_id: accountId,
          connected_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }
  if (newlyActive) {
    try {
      await installComposioMcp(supabase, userId);
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "composio mcp install failed",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  const { data: refreshed } = await supabase
    .from("connections")
    .select("toolkit, status, connected_at")
    .eq("user_id", userId);
  return NextResponse.json({ connections: refreshed ?? [] });
}

/** Disconnect: revoke the account with Composio, then mark the mirror. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    toolkit?: string;
  };
  const toolkit = body.toolkit?.toLowerCase();
  if (!toolkit || !/^[a-z0-9_-]{1,64}$/.test(toolkit)) {
    return NextResponse.json({ error: "invalid toolkit" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("connections")
    .select("id, external_account_id, status")
    .eq("user_id", userId)
    .eq("provider", "composio")
    .eq("toolkit", toolkit)
    .maybeSingle();
  const row = data as {
    id: string;
    external_account_id: string | null;
    status: string;
  } | null;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (row.external_account_id) {
    try {
      await deleteConnectedAccount(row.external_account_id);
    } catch (error) {
      // Already gone at Composio → the revoke is done; anything else is a
      // real failure and the mirror must NOT claim revoked.
      if (!(error instanceof ComposioApiError && error.status === 404)) {
        return NextResponse.json({ error: "revoke failed" }, { status: 502 });
      }
    }
  }
  await supabase
    .from("connections")
    .update({ status: "revoked" })
    .eq("id", row.id);
  return NextResponse.json({ ok: true });
}
