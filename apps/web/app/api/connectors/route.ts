/**
 * Connectors (M7): discovery, connect, and status — all server-side. The
 * browser sees toolkit names and connection statuses; Composio credentials
 * and the per-user MCP endpoint never reach it. Mutations share their code
 * path with the MA5 connect mini-app (lib/connectors/manage.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { parseBody } from "@/lib/http/body";
import { env } from "@/lib/env";
import { listToolkits } from "@/lib/composio/client";
import { connectionHealth } from "@/lib/connectors/meta";
import {
  beginConnect,
  disconnectToolkit,
  syncConnections,
  TOOLKIT_SLUG_PATTERN,
} from "@/lib/connectors/manage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ToolkitBody = z.object({
  toolkit: z
    .string()
    .trim()
    .min(1)
    .transform((v) => v.toLowerCase())
    .refine((v) => TOOLKIT_SLUG_PATTERN.test(v), { message: "invalid toolkit" }),
});

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
  const parsed = await parseBody(request, ToolkitBody);
  if (!parsed.ok) return parsed.response;
  const { toolkit } = parsed.data;

  const supabase = serviceClient();
  const link = await beginConnect(
    supabase,
    userId,
    toolkit,
    `${env.appOrigin()}/home`
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
  const connections = await syncConnections(supabase, userId);
  return NextResponse.json({ connections });
}

/** Disconnect: revoke the account with Composio, then mark the mirror. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, ToolkitBody);
  if (!parsed.ok) return parsed.response;
  const { toolkit } = parsed.data;

  const supabase = serviceClient();
  const result = await disconnectToolkit(supabase, userId, toolkit);
  if (result === "not_found") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (result === "revoke_failed") {
    return NextResponse.json({ error: "revoke failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
