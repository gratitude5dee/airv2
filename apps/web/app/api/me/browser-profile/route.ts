/**
 * Real-profile browsing import endpoint. GET (owner session) reports the
 * box-side snapshot status and mints a short-TTL upload ticket plus the
 * exact one-command packager the owner runs on their machine (it reads
 * their default Chromium browser's ACTIVE profile — cookies, saved logins,
 * preferences — nothing else). POST (Bearer upload ticket) validates one
 * base64 part and stages it on the owner's box; the final part assembles
 * `.hermes/browser-profile/<browser>/` and flips `browser.use_real_profile`
 * on — content never touches Postgres (C4). DELETE (owner session) revokes
 * consent: the snapshot store is deleted and the toggle flipped off.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import {
  BrowserProfileInputError,
  disableBrowserProfile,
  MAX_PART_B64_BYTES,
  mintBrowserProfileTicket,
  parseBrowserProfileChunk,
  readBrowserProfileStatus,
  storeBrowserProfileChunk,
  verifyBrowserProfileTicket,
} from "@/lib/context/browser-profile";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";

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
    const status = await readBrowserProfileStatus(supabase, userId);
    const ticket = mintBrowserProfileTicket(userId);
    const command = `curl -fsSL ${env.appOrigin()}/browser-profile-import.sh -o /tmp/air-browser-import.sh && AIR_BROWSER_ENDPOINT=${env.appOrigin()}/api/me/browser-profile bash /tmp/air-browser-import.sh ${ticket}`;
    return NextResponse.json({ status, command }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "status read failed" },
      { status: 502, headers: NO_STORE }
    );
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = verifyBrowserProfileTicket(token);
  if (!claims) {
    return NextResponse.json(
      { error: "invalid or expired upload ticket" },
      { status: 401, headers: NO_STORE }
    );
  }
  const raw = await request.text();
  if (raw.length > MAX_PART_B64_BYTES + 64 * 1024) {
    return NextResponse.json(
      { error: "upload too large — split parts smaller" },
      { status: 413, headers: NO_STORE }
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "body must be JSON" },
      { status: 400, headers: NO_STORE }
    );
  }
  const supabase = serviceClient();
  try {
    const chunk = parseBrowserProfileChunk(body);
    const status = await storeBrowserProfileChunk(supabase, claims.userId, chunk);
    return NextResponse.json({ ok: true, status }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof BrowserProfileInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: NO_STORE }
      );
    }
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "upload failed" },
      { status: 502, headers: NO_STORE }
    );
  } finally {
    await armStopAfter(supabase, claims.userId).catch(() => undefined);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  try {
    const status = await disableBrowserProfile(supabase, userId);
    return NextResponse.json({ ok: true, status }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "disable failed" },
      { status: 502, headers: NO_STORE }
    );
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
