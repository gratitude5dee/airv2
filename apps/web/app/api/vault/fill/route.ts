/**
 * Agent-staged vault fill (R-EV-07 gap K196): the box agent writes a
 * create-op payload itself at ~/.hermes/vault/.inbox/agent-<id>.json — the
 * secret never transits this route or Postgres (C18) — then asks here for
 * the owner's approval. A pending `vault_fill` decision row is what shows
 * up in Needs-you; approving applies the staged file box-side (see
 * lib/decisions/resolve.ts), dismissing shreds it.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireBox } from "@/lib/auth/guard";
import type { VaultItemKind } from "@/lib/vault/client";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" } as const;

const ITEM_KINDS = new Set<VaultItemKind>([
  "login",
  "card",
  "api_key",
  "note",
  "identity",
]);

// Only inbox paths the agent itself names — the CLI applies and shreds them.
const STAGING_RE = /^\.hermes\/vault\/\.inbox\/agent-[A-Za-z0-9_-]{8,64}\.json$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const box = await requireBox(supabase, request).catch(guardResponse);
  if (box instanceof NextResponse) return box;
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    kind?: unknown;
    staging_ref?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const kind = body.kind;
  const stagingRef = body.staging_ref;
  if (
    !name ||
    typeof kind !== "string" ||
    !ITEM_KINDS.has(kind as VaultItemKind) ||
    typeof stagingRef !== "string" ||
    !STAGING_RE.test(stagingRef)
  ) {
    return NextResponse.json(
      { error: "invalid request" },
      { status: 400, headers: NO_STORE }
    );
  }

  let decision: { id: string } | null;
  try {
    decision = await db.write(
      supabase
        .from("decisions")
        .insert({
          user_id: box.userId,
          kind: "vault_fill",
          ref: stagingRef,
          label: `Store "${name}" in the vault`,
          payload: { name, kind, box_id: box.boxId },
        })
        .select("id")
        .single(),
      { what: "file vault_fill decision", user_id: box.userId }
    );
  } catch {
    return NextResponse.json(
      { error: "could not file" },
      { status: 502, headers: NO_STORE }
    );
  }
  if (!decision) {
    return NextResponse.json(
      { error: "could not file" },
      { status: 502, headers: NO_STORE }
    );
  }
  return NextResponse.json(
    { decision_id: decision.id },
    { status: 202, headers: NO_STORE }
  );
}
