/**
 * Voice transcription (M13). Session-authenticated; the audio buffer dies
 * with the request (C18) — no Storage write, no Postgres row with content,
 * no box involvement. Rate limiting and billing ride cost_events ('stt').
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import {
  audioExtension,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  STT_HOURLY_LIMIT,
  sttCostCents,
  transcribeAudio,
  TranscriptionError,
} from "@/lib/voice/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "missing_audio" }, { status: 400 });
  }
  const ext = audioExtension(audio.type);
  if (!ext) {
    return NextResponse.json({ error: "unsupported_format" }, { status: 400 });
  }
  const rawDuration = Number(form?.get("duration_s"));
  const durationS =
    Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.round(rawDuration)
      : 0;
  if (audio.size > MAX_AUDIO_BYTES || durationS > MAX_AUDIO_SECONDS) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const supabase = serviceClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("cost_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "stt")
    .gte("occurred_at", oneHourAgo);
  if ((count ?? 0) >= STT_HOURLY_LIMIT) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let text: string;
  try {
    text = await transcribeAudio(audio, ext);
  } catch (error) {
    const status =
      error instanceof TranscriptionError ? error.status : undefined;
    console.error(
      JSON.stringify({ msg: "stt failed", user_id: userId, provider_status: status })
    );
    return NextResponse.json({ error: "transcription_failed" }, { status: 502 });
  }

  await supabase.from("cost_events").insert({
    user_id: userId,
    kind: "stt",
    amount_cents: sttCostCents(durationS),
    ref: null,
  });

  return NextResponse.json({ text, duration_s: durationS });
}
