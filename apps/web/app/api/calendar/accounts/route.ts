/**
 * V3 calendar source connect/disconnect. calendar_accounts holds metadata
 * only (C4): external_ref is a Composio account id or a box-source reference
 * — NEVER a URL or a token. The Apple ICS URL and the cal.com API key are
 * credentials: they are written straight into the box's calendar sources
 * file (~/.hermes/calendar/sources.json, mode 600) and referenced by id.
 * (The spec's Vault item store is V1, in flight in parallel — external_ref
 * will point at vault items once air-vault lands; the box-resident reference
 * keeps the same invariant: no secret in Postgres.)
 */
import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { sealSecret } from "@/lib/crypto/secretbox";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import {
  nudgeSync,
  removeBoxSource,
  upsertBoxSource,
} from "@/lib/calendar/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PROVIDERS = ["google", "apple_ics", "calcom", "email"] as const;
type Provider = (typeof PROVIDERS)[number];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("calendar_accounts")
    .select("id, provider, label, status, last_synced_at, created_at")
    .eq("user_id", userId)
    .neq("status", "revoked")
    .order("created_at", { ascending: true });
  return NextResponse.json({ accounts: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    label?: string;
    /** apple_ics: the private subscription URL (webcal:// or https://). */
    ics_url?: string;
    /** calcom: the API key. */
    api_key?: string;
  };
  const provider = body.provider as Provider | undefined;
  if (!provider || !PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "invalid provider" }, { status: 400 });
  }
  const supabase = serviceClient();

  if (provider === "google") {
    // Delegates to the existing Connectors flow (M7): the account must
    // already be connected there; we only record the reference.
    const { data: connection } = await supabase
      .from("connections")
      .select("external_account_id, status")
      .eq("user_id", userId)
      .eq("provider", "composio")
      .eq("toolkit", "googlecalendar")
      .maybeSingle();
    if (!connection || connection.status !== "active") {
      return NextResponse.json(
        { error: "connect Google Calendar in Connectors first" },
        { status: 409 }
      );
    }
    const { data, error } = await supabase
      .from("calendar_accounts")
      .upsert(
        {
          user_id: userId,
          provider: "google",
          label: body.label ?? "Google Calendar",
          external_ref: connection.external_account_id as string,
          status: "active",
        },
        { onConflict: "user_id,provider,external_ref" }
      )
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: data.id });
  }

  if (provider === "email") {
    const { data, error } = await supabase
      .from("calendar_accounts")
      .upsert(
        {
          user_id: userId,
          provider: "email",
          label: body.label ?? "Email invites",
          external_ref: "inbound-email",
          status: "active",
        },
        { onConflict: "user_id,provider,external_ref" }
      )
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: data.id });
  }

  // apple_ics / calcom: the secret goes to the box, never to Postgres.
  let secret: string;
  if (provider === "apple_ics") {
    const raw = (body.ics_url ?? "").trim().replace(/^webcal:\/\//i, "https://");
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return NextResponse.json({ error: "invalid ICS URL" }, { status: 400 });
    }
    if (parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "ICS URL must be https" },
        { status: 400 }
      );
    }
    secret = parsed.toString();
  } else {
    secret = (body.api_key ?? "").trim();
    if (!secret) {
      return NextResponse.json({ error: "api_key required" }, { status: 400 });
    }
  }

  const accountId = randomUUID();
  const box = await ensureBoxAwake(supabase, userId);
  let webhookSecret: string | undefined;
  try {
    await upsertBoxSource(box.boxId, { id: accountId, provider, secret });

    // calcom: mint a per-account webhook secret, sealed at rest (AES-256-GCM
    // via lib/crypto/secretbox); returned once so the user can register the
    // webhook at cal.com.
    let webhookSecretSealed: string | null = null;
    if (provider === "calcom") {
      const sealKey = env.boxDashboardAuthKey();
      if (!sealKey) {
        // Don't leave an untracked credential on the box.
        await removeBoxSource(box.boxId, accountId).catch(() => undefined);
        return NextResponse.json(
          { error: "sealing key unavailable" },
          { status: 500 }
        );
      }
      webhookSecret = randomBytes(32).toString("hex");
      webhookSecretSealed = sealSecret(webhookSecret, sealKey);
    }

    const { error } = await supabase.from("calendar_accounts").insert({
      id: accountId,
      user_id: userId,
      provider,
      label:
        body.label ?? (provider === "apple_ics" ? "Apple Calendar" : "cal.com"),
      external_ref: `box:${accountId}`,
      webhook_secret_sealed: webhookSecretSealed,
      status: "active",
    });
    if (error) {
      await removeBoxSource(box.boxId, accountId).catch(() => undefined);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await nudgeSync(box.target, box.boxId).catch(() => undefined);
  } finally {
    // ensureBoxAwake nulls stop_after: re-arm no matter how we exit.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }

  return NextResponse.json({
    id: accountId,
    ...(webhookSecret
      ? {
          webhook_secret: webhookSecret,
          webhook_url: `${env.appOrigin()}/api/inbound/calcom?account=${accountId}`,
        }
      : {}),
  });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("calendar_accounts")
    .update({ status: "revoked" })
    .eq("id", body.id)
    .eq("user_id", userId)
    .select("id, provider, external_ref");
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const row = data[0] as { external_ref: string | null };
  if (row.external_ref?.startsWith("box:")) {
    try {
      const box = await ensureBoxAwake(supabase, userId);
      await removeBoxSource(box.boxId, row.external_ref.slice(4));
    } catch {
      // box asleep/unreachable — the source file entry is orphaned but the
      // account row is revoked; the next connect rewrites the file.
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }
  return NextResponse.json({ ok: true });
}
