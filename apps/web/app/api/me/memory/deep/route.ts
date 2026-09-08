/**
 * Deep memory (docs/memory-upgrade.md) — owner-session status, reindex and
 * clear-with-confirm for the box-local OpenViking store. Status is read live
 * from the box (the shared DB stores nothing about deep memory — not even a
 * flag it doesn't need); reindex re-renders ov.conf and re-adds the
 * onboarding context; clear wipes whole roots on the box.
 * Only metadata transits: counts, booleans, bytes — never memory content.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import {
  deepMemoryClear,
  deepMemoryReindex,
  deepMemoryStatus,
  isDeepMemoryClearScope,
} from "@/lib/memory/deep";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

function busy(): NextResponse {
  return NextResponse.json(
    { error: "box busy starting — try again in a minute" },
    { status: 503, headers: NO_STORE }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    try {
      const status = await deepMemoryStatus(box.boxId);
      return NextResponse.json(status, { headers: NO_STORE });
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "deep memory status failed" },
      { status: 502, headers: NO_STORE }
    );
  }
}

/** `{ action: "reindex" }` — re-add imessage-history/ + onairos.md.
 * `{ action: "clear", scope: "resources" | "memories" | "all", confirm: true }`
 * — wipe the indexed context, the derived memories, or both. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    scope?: unknown;
    confirm?: unknown;
  } | null;
  if (body?.action === "clear") return clear(userId, body);
  if (!body || body.action !== "reindex") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    try {
      const ok = await deepMemoryReindex(box.boxId);
      if (!ok) {
        return NextResponse.json(
          { error: "reindex failed — deep memory degraded" },
          { status: 502, headers: NO_STORE }
        );
      }
      return NextResponse.json({ ok: true, queued: true }, { status: 202, headers: NO_STORE });
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "deep memory reindex failed" },
      { status: 502, headers: NO_STORE }
    );
  }
}

async function clear(
  userId: string,
  body: { scope?: unknown; confirm?: unknown }
): Promise<NextResponse> {
  const scope = body.scope;
  if (!isDeepMemoryClearScope(scope)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "confirm required — clearing deep memory is irreversible" },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    try {
      const ok = await deepMemoryClear(box.boxId, scope);
      if (!ok) {
        return NextResponse.json(
          { error: "deep memory clear failed" },
          { status: 502, headers: NO_STORE }
        );
      }
      return NextResponse.json({ ok: true, scope }, { headers: NO_STORE });
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "deep memory clear failed" },
      { status: 502, headers: NO_STORE }
    );
  }
}
