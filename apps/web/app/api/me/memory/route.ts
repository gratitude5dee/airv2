/**
 * MA9.1 — owner-session Memory surface: view MEMORY.md + USER.md, edit
 * USER.md, clear with an explicit confirm. Contents flow box → response only
 * (C4): no Postgres write, no log line ever carries a memory byte.
 *
 * GET returns `user_revision`, the fingerprint of USER.md as served; a PUT
 * that echoes it as `base_revision` only lands if the agent has not
 * rewritten the profile since (409 otherwise).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import {
  clearMemoryFiles,
  isProfileRevision,
  profileRevision,
  readMemoryFiles,
  USER_PROFILE_CHAR_LIMIT,
  UserProfileConflictError,
  writeUserProfile,
  type MemoryTarget,
} from "@/lib/memory/files";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      const files = await readMemoryFiles(box.boxId);
      return NextResponse.json(
        {
          ...files,
          user_char_limit: USER_PROFILE_CHAR_LIMIT,
          user_revision: profileRevision(files.user),
        },
        { headers: NO_STORE }
      );
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "memory read failed" },
      { status: 502, headers: NO_STORE }
    );
  }
}

/** Edit USER.md (the user profile — the one memory file the owner authors). */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    user?: unknown;
    base_revision?: unknown;
  } | null;
  if (!body || typeof body.user !== "string") {
    return NextResponse.json(
      { error: "user (string) required" },
      { status: 400 }
    );
  }
  const baseRevision = isProfileRevision(body.base_revision)
    ? body.base_revision
    : undefined;
  if (body.base_revision !== undefined && baseRevision === undefined) {
    return NextResponse.json(
      { error: "base_revision must be a sha256 hex digest" },
      { status: 400 }
    );
  }
  if (body.user.length > USER_PROFILE_CHAR_LIMIT) {
    return NextResponse.json(
      { error: `user profile exceeds ${USER_PROFILE_CHAR_LIMIT} chars` },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    try {
      await writeUserProfile(box.boxId, body.user, baseRevision);
      return NextResponse.json(
        { ok: true, user_revision: profileRevision(body.user) },
        { headers: NO_STORE }
      );
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    if (error instanceof UserProfileConflictError) {
      return NextResponse.json(
        { error: "profile changed since it was loaded", conflict: true },
        { status: 409, headers: NO_STORE }
      );
    }
    return NextResponse.json(
      { error: "memory write failed" },
      { status: 502, headers: NO_STORE }
    );
  }
}

/** Clear-with-confirm: `{ action: "clear", target, confirm: true }`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    target?: unknown;
    confirm?: unknown;
  } | null;
  const target = body?.target;
  if (
    !body ||
    body.action !== "clear" ||
    (target !== "memory" && target !== "user" && target !== "both")
  ) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "confirm required — clearing memory is irreversible" },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    try {
      await clearMemoryFiles(box.boxId, target as MemoryTarget);
      // A "fresh start" clear of both files leaves deep memory (the box's
      // OpenViking store) intact; offer that separate, confirm-gated wipe
      // via POST /api/me/memory/deep rather than forcing it here.
      return NextResponse.json(
        target === "both" ? { ok: true, deep_memory_offer: true } : { ok: true },
        { headers: NO_STORE }
      );
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "memory clear failed" },
      { status: 502, headers: NO_STORE }
    );
  }
}
