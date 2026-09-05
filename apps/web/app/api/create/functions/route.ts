/**
 * V11 §14.1 `/api/create/functions` — the Functions tab's read model and
 * the staging entry point.
 *
 * `GET ?slug=|?app=`  status, declared/approved manifests, resources, secret
 *                     names, cap meter, last 20 request codes (content-free).
 * `POST {slug|app, egress?, cap?, db?, kv?, entry?}`  stage a declaration
 *                     (owner or the owner's Box via `air-create functions`)
 *                     and file the `miniapp_backend` decision the owner
 *                     still has to approve. Nothing here enables anything
 *                     (CR4): the response says "needs your approval".
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { loadFunctions } from "@/lib/functions/backend";
import { stageBackend } from "@/lib/functions/approval";
import {
  appOf,
  callerOf,
  functionsErrorResponse,
  jsonBody,
} from "@/lib/functions/createRoute";
import {
  describeEgressRejection,
  egressHostRejection,
  FN_DAILY_CAP_DEFAULT_USD,
  functionsDeclarationSchema,
  normalizeEgressHost,
} from "@/lib/functions/egress";
import { functionsStatus, pendingBackendDecisionId } from "@/lib/functions/tab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const caller = await callerOf(request, supabase, true);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  try {
    const app = await appOf(supabase, caller.userId, {
      slug: params.get("slug") ?? undefined,
      app: params.get("app") ?? undefined,
    });
    const [row, decision] = await Promise.all([
      loadFunctions(supabase, app.id),
      pendingBackendDecisionId(supabase, caller.userId, app.slug),
    ]);
    return NextResponse.json(await functionsStatus(supabase, app, row, decision));
  } catch (error) {
    return functionsErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const caller = await callerOf(request, supabase, true);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  try {
    const app = await appOf(supabase, caller.userId, body);
    const existing = await loadFunctions(supabase, app.id);
    const base = existing?.declared ?? null;
    const rawHosts = Array.isArray(body["egress"])
      ? body["egress"]
      : (base?.egress ?? []);
    const hosts: string[] = [];
    for (const raw of rawHosts) {
      if (typeof raw !== "string") {
        return NextResponse.json({ error: "egress must be a list of hostnames" }, { status: 400 });
      }
      const rejection = egressHostRejection(raw);
      if (rejection) {
        return NextResponse.json(
          { error: `${raw.trim()}: ${describeEgressRejection(rejection)}` },
          { status: 400 }
        );
      }
      hosts.push(normalizeEgressHost(raw));
    }
    const cap =
      body["cap"] === undefined
        ? (base?.ai.dailyCapUsd ?? FN_DAILY_CAP_DEFAULT_USD)
        : Number(body["cap"]);
    const parsed = functionsDeclarationSchema.safeParse({
      entry: typeof body["entry"] === "string" ? body["entry"] : (base?.entry ?? "functions/index.ts"),
      db: typeof body["db"] === "boolean" ? body["db"] : (base?.db ?? false),
      kv: typeof body["kv"] === "boolean" ? body["kv"] : (base?.kv ?? false),
      egress: hosts,
      ai: { dailyCapUsd: cap },
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "invalid declaration" },
        { status: 400 }
      );
    }
    const { row, decision } = await stageBackend(supabase, caller.userId, app.slug, parsed.data);
    const pending = decision ?? (await pendingBackendDecisionId(supabase, caller.userId, app.slug));
    return NextResponse.json({
      ok: true,
      slug: app.slug,
      status: row.status,
      declared: row.declared,
      decision_id: pending,
      note: pending
        ? "Backend changes staged — they need your approval in Needs-you or the Functions tab before they take effect."
        : "Declaration matches what is already approved.",
    });
  } catch (error) {
    return functionsErrorResponse(error);
  }
}
