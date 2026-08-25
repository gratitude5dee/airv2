/**
 * V2 Vault surface. GET lists metadata straight from the Postgres mirror
 * (`vault_items`) so the tab renders instantly without waking the box (C18 —
 * the mirror holds no values). POST/PUT/DELETE wake the box (standard 429 on
 * StartLimitError) and route through the V1 client's applyBatch: box CLI
 * mutation → metadata mirror → vault_events audit. Responses carry metadata
 * only — raw values never transit this route.
 */
import { NextRequest, NextResponse } from "next/server";
import { asRecord } from "@/lib/records";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import {
  applyBatch,
  VaultCliError,
  type VaultItemInput,
  type VaultItemKind,
  type VaultOperation,
} from "@/lib/vault/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KINDS: VaultItemKind[] = ["login", "card", "api_key", "note", "identity"];
const ENV_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;
const FIELD_NAME_RE = /^[a-z_][a-z0-9_]*$/;
const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

function parseItemInput(
  raw: unknown,
  partial: boolean
): VaultItemInput | Partial<VaultItemInput> | null {
  const body = asRecord(raw);
  if (!body) return null;
  const item: Partial<VaultItemInput> = {};
  if (body.kind !== undefined) {
    if (!KINDS.includes(body.kind as VaultItemKind)) return null;
    item.kind = body.kind as VaultItemKind;
  }
  if (body.name !== undefined) {
    if (
      typeof body.name !== "string" ||
      body.name.trim().length === 0 ||
      body.name.length > 120
    ) {
      return null;
    }
    item.name = body.name.trim();
  }
  if (body.fields !== undefined) {
    const rawFields = asRecord(body.fields);
    if (!rawFields) return null;
    const fields: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(rawFields)) {
      if (!FIELD_NAME_RE.test(key)) return null;
      if (value !== null && typeof value !== "string") return null;
      if (typeof value === "string" && value.length > 10000) return null;
      fields[key] = value as string | null;
    }
    item.fields = fields;
  }
  if (body.env_var !== undefined) {
    if (body.env_var !== null) {
      if (
        typeof body.env_var !== "string" ||
        !ENV_NAME_RE.test(body.env_var)
      ) {
        return null;
      }
      item.env_var = body.env_var;
    } else {
      item.env_var = null;
    }
  }
  if (body.totp_seed !== undefined) {
    if (body.totp_seed !== null && typeof body.totp_seed !== "string") {
      return null;
    }
    item.totp_seed = body.totp_seed as string | null;
  }
  if (!partial && (!item.kind || !item.name)) return null;
  return item;
}

async function mutate(
  request: NextRequest,
  buildOps: (body: Record<string, unknown>) => VaultOperation[] | null
): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const operations = body ? buildOps(body) : null;
  if (!operations || operations.length === 0) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  try {
    const box = await ensureBoxAwake(supabase, session.userId);
    let results;
    try {
      results = await applyBatch(box.boxId, session.userId, operations);
    } finally {
      await armStopAfter(supabase, session.userId).catch(() => undefined);
    }
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json(
        { error: "start_limit_reached" },
        { status: 429 }
      );
    }
    if (error instanceof VaultCliError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "env_var_taken" ? 409 : 400 }
      );
    }
    console.error(
      JSON.stringify({
        msg: "vault mutation failed",
        user_id: session.userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "vault update failed" }, { status: 502 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("vault_items")
    .select("id, kind, name, masked, env_var, totp_enabled, created_at, updated_at")
    .eq("user_id", session.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "list failed" }, { status: 502 });
  }
  return NextResponse.json(
    { items: data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return mutate(request, (body) => {
    const item = parseItemInput(body.item, false);
    if (!item) return null;
    return [{ op: "create", item: item as VaultItemInput }];
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return mutate(request, (body) => {
    if (typeof body.id !== "string" || !ID_RE.test(body.id)) return null;
    const item = parseItemInput(body.item, true);
    if (!item || Object.keys(item).length === 0) return null;
    return [{ op: "update", id: body.id, item }];
  });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return mutate(request, (body) => {
    if (typeof body.id !== "string" || !ID_RE.test(body.id)) return null;
    return [{ op: "delete", id: body.id }];
  });
}
