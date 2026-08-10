/**
 * Brand kit source of record (CM0). GET returns the source plus the compiled
 * tokens; PUT validates, stores, and recompiles all targets in one write —
 * the box mirror runs best-effort (a sleeping box catches up on its next
 * wake via mirrorBrandIfStale). Media bytes never touch Postgres (CC2);
 * the palette/voice/claims source is tokens and URL refs only.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { compileBrand, validateBrandSource } from "@/lib/brand/compile";
import { mirrorBrandToBox } from "@/lib/brand/mirror";
import { getBox } from "@/lib/box/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("brand_kits")
    .select("source, rev, mirrored_rev, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error(
      JSON.stringify({ msg: "brand kit load failed", user_id: userId, error: error.message })
    );
    return NextResponse.json({ error: "brand load failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ brand: null });
  }
  const source = validateBrandSource(data.source);
  return NextResponse.json({
    brand: {
      source,
      tokens: JSON.parse(compileBrand(source).tokensJson) as unknown,
      rev: data.rev,
      mirrored: data.mirrored_rev >= data.rev,
      updated_at: data.updated_at,
    },
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { source?: unknown };
  let source;
  try {
    source = validateBrandSource(body.source);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid brand" },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  const { data: existing, error: loadError } = await supabase
    .from("brand_kits")
    .select("rev")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) {
    return NextResponse.json({ error: "brand save failed" }, { status: 500 });
  }
  // Optimistic concurrency: the write is conditional on the rev we read, so
  // two overlapping saves can never both claim the same rev (the loser gets
  // a 409 and retries with fresh state) and mirrored_rev can never be
  // stamped for bytes that lost the race.
  const rev = (existing?.rev ?? 0) + 1;
  let saveError: { message: string } | null = null;
  let conflicted = false;
  if (existing) {
    const { data: updated, error } = await supabase
      .from("brand_kits")
      .update({
        source: source as unknown as Record<string, unknown>,
        rev,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("rev", existing.rev)
      .select("rev");
    saveError = error;
    conflicted = !error && (updated ?? []).length === 0;
  } else {
    const { error } = await supabase.from("brand_kits").insert({
      user_id: userId,
      source: source as unknown as Record<string, unknown>,
      rev,
      updated_at: new Date().toISOString(),
    });
    // A concurrent first save wins the unique(user_id) race.
    conflicted = error?.code === "23505";
    saveError = conflicted ? null : error;
  }
  if (conflicted) {
    return NextResponse.json({ error: "conflict — reload and retry" }, { status: 409 });
  }
  if (saveError) {
    console.error(
      JSON.stringify({ msg: "brand kit save failed", user_id: userId, error: saveError.message })
    );
    return NextResponse.json({ error: "brand save failed" }, { status: 500 });
  }

  // Mirror into the box if it happens to be awake; a sleeping box is not
  // woken for a brand edit — it catches up on its next resume.
  let mirrored = false;
  const { data: boxRow } = await supabase
    .from("boxes")
    .select("provider_box_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (boxRow?.provider_box_id) {
    try {
      const box = await getBox(boxRow.provider_box_id);
      if (box.state === "ready" || box.state === "idle") {
        await mirrorBrandToBox(supabase, userId, boxRow.provider_box_id);
        mirrored = true;
      }
    } catch (error) {
      console.log(
        JSON.stringify({
          msg: "brand mirror on write failed",
          user_id: userId,
          box_id: boxRow.provider_box_id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  return NextResponse.json({ ok: true, rev, mirrored });
}
