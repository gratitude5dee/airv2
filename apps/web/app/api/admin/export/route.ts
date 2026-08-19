/**
 * M8 export: one query per table plus a pointer to the box snapshot. The
 * archive is routing/metadata only — durable content lives in the box
 * filesystem and is exported by pulling a box snapshot (returned as a
 * reference, not streamed here).
 */
import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { EXPORT_TABLES } from "@/lib/admin/export-tables";
import { readMemoryFiles } from "@/lib/memory/files";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { env } from "@/lib/env";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Keyed pseudonym for a payer wallet: stable across exports so repeat
 * buyers correlate, but not reversible to the on-chain address. */
function pseudonymizePayer(address: string | null): string | null {
  if (!address) return null;
  const digest = createHmac("sha256", env.sessionSecret())
    .update(address.toLowerCase())
    .digest("hex");
  return `payer:${digest.slice(0, 16)}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = request.nextUrl.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const archive: Record<string, unknown> = {};

  for (const { table, column, select } of EXPORT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq(column, userId);
    archive[table] = error ? { error: error.message } : (data ?? []);
  }

  // room_members is keyed through rooms (the one wave table without a
  // user_id); export the memberships of the user's own rooms.
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id")
    .eq("user_id", userId);
  const roomIds = (rooms ?? []).map((room) => room.id as string);
  if (roomIds.length > 0) {
    const { data: members } = await supabase
      .from("room_members")
      .select("*")
      .in("room_id", roomIds);
    archive.room_members = members ?? [];
  } else {
    archive.room_members = [];
  }

  // MA11: x402 receipts are app-keyed (no user_id) — export the settlement
  // ledger of the user's own published apps (their publisher revenue).
  // Payers are third parties: their wallet address is replaced with a keyed
  // pseudonym (stable within an install, so repeat buyers still correlate)
  // and the tx hash — which resolves to the payer on-chain — stays home.
  const { data: ownedApps } = await supabase
    .from("mini_apps")
    .select("id")
    .eq("owner_user_id", userId);
  const ownedAppIds = (ownedApps ?? []).map((app) => app.id as string);
  if (ownedAppIds.length > 0) {
    const { data: receipts } = await supabase
      .from("x402_receipts")
      .select("jti, app_id, payer_address, amount_usdc, settled_at")
      .in("app_id", ownedAppIds);
    archive.x402_receipts = (receipts ?? []).map((row) => ({
      jti: row.jti,
      app_id: row.app_id,
      payer: pseudonymizePayer(row.payer_address as string | null),
      amount_usdc: row.amount_usdc,
      settled_at: row.settled_at,
    }));
  } else {
    archive.x402_receipts = [];
  }

  const { data: line } = await supabase
    .from("lines")
    .select("phone, mode, role, assigned_at")
    .eq("assigned_user_id", userId);
  archive.lines = line ?? [];

  // Secret columns are never exported.
  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id, state, stop_after, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  archive.box = box
    ? {
        ...box,
        snapshot_note:
          "durable agent data lives in this box's filesystem; pull a box snapshot to complete the export",
      }
    : null;

  // MA9.1: the two memory files ride the archive (box → response only — C4:
  // their contents are never persisted or logged control-plane-side). Best
  // effort: a start-limited or missing box degrades to an explanatory note.
  if (box) {
    try {
      const awake = await ensureBoxAwake(supabase, userId);
      const files = await readMemoryFiles(awake.boxId);
      archive.memory_files = {
        "MEMORY.md": files.memory,
        "USER.md": files.user,
      };
    } catch {
      archive.memory_files = {
        error:
          "box unavailable — memory files are in the box snapshot referenced above",
      };
    }
  } else {
    archive.memory_files = null;
  }

  return NextResponse.json({ user_id: userId, exported_at: new Date().toISOString(), archive });
}
