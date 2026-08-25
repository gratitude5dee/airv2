/**
 * CM4 publish worker entrypoint: Vercel cron, CRON_SECRET-authorized. Due
 * slots are grouped per user so a machine start serves every slot in the
 * window (one wake per user, never one per post). The response carries
 * counters only — no box origin, route, or token material.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { publishDueSlots } from "@/lib/publish/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function authorized(request: NextRequest): boolean {
  const secret = process.env["CRON_SECRET"] ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const tokenBytes = Buffer.from(token);
  const secretBytes = Buffer.from(secret);
  if (tokenBytes.length !== secretBytes.length) return false;
  return timingSafeEqual(tokenBytes, secretBytes);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await publishDueSlots(serviceClient());
  return NextResponse.json({ ok: true, ...result });
}
