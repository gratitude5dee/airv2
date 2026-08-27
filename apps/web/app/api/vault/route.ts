/**
 * V2 Vault surface. GET lists metadata straight from the Postgres mirror
 * (`vault_items`) so the tab renders instantly without waking the box (C18 —
 * the mirror holds no values). POST/PUT/DELETE wake the box (standard 429 on
 * StartLimitError) and route through the V1 client's applyBatch: box CLI
 * mutation → metadata mirror → vault_events audit. Responses carry metadata
 * only — raw values never transit this route.
 *
 * Request bodies are parsed by the Zod schemas in `lib/vault/schema.ts`
 * (card items are structurally validated there) and every mutation is
 * same-origin gated (`lib/http/origin.ts`).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/http/origin";
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
  type VaultOperation,
} from "@/lib/vault/client";
import { cardFieldsIssue } from "@/lib/vault/payment-card";
import {
  vaultCreateBodySchema,
  vaultDeleteBodySchema,
  vaultUpdateBodySchema,
} from "@/lib/vault/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Shared mutation path: same-origin gate → owner session → Zod parse → box
 * apply. `toOperations` only ever sees an already-parsed body.
 */
async function mutate<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S,
  toOperations: (body: z.infer<S>) => VaultOperation[],
  validate?: (
    body: z.infer<S>,
    context: { supabase: ReturnType<typeof serviceClient>; userId: string }
  ) => Promise<string | null>
): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "forbidden origin" },
      { status: 403, headers: NO_STORE }
    );
  }
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid request",
        // Field/kind names only — issue messages never quote a value.
        message: parsed.error.issues[0]?.message ?? "invalid request",
      },
      { status: 400, headers: NO_STORE }
    );
  }
  const issue = validate
    ? await validate(parsed.data, { supabase, userId: session.userId })
    : null;
  if (issue) {
    return NextResponse.json(
      { error: "invalid request", message: issue },
      { status: 400, headers: NO_STORE }
    );
  }
  const operations = toOperations(parsed.data);
  try {
    const box = await ensureBoxAwake(supabase, session.userId);
    let results;
    try {
      results = await applyBatch(box.boxId, session.userId, operations);
    } finally {
      await armStopAfter(supabase, session.userId).catch(() => undefined);
    }
    return NextResponse.json({ results }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json(
        { error: "start_limit_reached" },
        { status: 429, headers: NO_STORE }
      );
    }
    if (error instanceof VaultCliError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        {
          status: error.code === "env_var_taken" ? 409 : 400,
          headers: NO_STORE,
        }
      );
    }
    console.error(
      JSON.stringify({
        msg: "vault mutation failed",
        user_id: session.userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json(
      { error: "vault update failed" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    );
  }
  const { data, error } = await supabase
    .from("vault_items")
    .select("id, kind, name, masked, env_var, totp_enabled, created_at, updated_at")
    .eq("user_id", session.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: "list failed" },
      { status: 502, headers: NO_STORE }
    );
  }
  return NextResponse.json({ items: data ?? [] }, { headers: NO_STORE });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return mutate(request, vaultCreateBodySchema, (body) => [
    { op: "create", item: body.item },
  ]);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  return mutate(
    request,
    vaultUpdateBodySchema,
    (body) => [{ op: "update", id: body.id, item: body.item }],
    // A patch may omit `kind`, so card rules are resolved against the
    // mirrored kind (metadata only — the mirror holds no values).
    async (body, { supabase, userId }) => {
      if (!body.item.fields || body.item.kind) return null;
      const { data } = await supabase
        .from("vault_items")
        .select("kind")
        .eq("user_id", userId)
        .eq("id", body.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (data?.kind !== "card") return null;
      return cardFieldsIssue(body.item.fields, false);
    }
  );
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return mutate(request, vaultDeleteBodySchema, (body) => [
    { op: "delete", id: body.id },
  ]);
}
