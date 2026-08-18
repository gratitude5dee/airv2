/**
 * Skill hub for the dashboard: search registries, install, uninstall.
 * All operations run inside the user's own box via the Box command API;
 * the browser only ever sees skill metadata (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import {
  checkSkillUpdates,
  inspectSkill,
  installSkill,
  searchHub,
  SkillHubError,
  SUGGESTED_SKILLS,
  uninstallSkill,
  updateSkill,
} from "@/lib/skills/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorResponse(error: unknown, userId: string, op: string): NextResponse {
  if (error instanceof StartLimitError) {
    return NextResponse.json({ error: "busy" }, { status: 429 });
  }
  if (error instanceof SkillHubError) {
    return NextResponse.json(
      { error: error.status === 400 ? error.message : "skill operation failed" },
      { status: error.status }
    );
  }
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(
    JSON.stringify({ msg: `skill ${op} failed`, user_id: userId, error: message })
  );
  return NextResponse.json({ error: "skill operation failed" }, { status: 500 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  // V8: suggested-for-you row (static seeds — no box call).
  if (params.get("suggested") === "1") {
    return NextResponse.json({ suggested: SUGGESTED_SKILLS });
  }
  // V8: hub-vs-installed update check, computed inside the box.
  if (params.get("updates") === "1") {
    try {
      const updates = await checkSkillUpdates(serviceClient(), userId);
      return NextResponse.json({ updates });
    } catch (error) {
      return errorResponse(error, userId, "update check");
    }
  }
  // V8: per-skill detail sheet (lockfile provenance + SKILL.md text).
  const detail = (params.get("detail") ?? "").trim();
  if (detail) {
    try {
      const skill = await inspectSkill(serviceClient(), userId, detail);
      return NextResponse.json({ skill });
    } catch (error) {
      return errorResponse(error, userId, "inspect");
    }
  }
  const query = (params.get("q") ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }
  try {
    const results = await searchHub(serviceClient(), userId, query);
    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error, userId, "search");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    identifier?: string;
    name?: string;
  };
  const supabase = serviceClient();
  try {
    if (body.action === "install" && body.identifier) {
      await installSkill(supabase, userId, body.identifier);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "uninstall" && body.name) {
      await uninstallSkill(supabase, userId, body.name);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "update" && body.name) {
      await updateSkill(supabase, userId, body.name);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  } catch (error) {
    return errorResponse(error, userId, body.action ?? "op");
  }
}
