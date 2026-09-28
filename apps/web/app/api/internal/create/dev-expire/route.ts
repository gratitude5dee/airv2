/**
 * V13 §9.1 `POST /api/internal/create/dev-expire` — the daily cron sweep's
 * Vercel half (§7.3): the `air-create` Worker's `17 4 * * *` trigger calls
 * here; `expireDevReleases` revokes every dev release past `dev_expires_at`
 * (CR17). Body: `{}` or `{now}` (an ISO timestamp for a replay run —
 * still within the signed-body contract).
 */
import type { NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { adapterBody, adapterErrorResponse, AdapterError } from "@/lib/create/adapter";
import { expireDevReleases } from "@/lib/create/release";

export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { body } = await adapterBody<{ now?: unknown }>(
      serviceClient(),
      request
    );
    let now = new Date();
    if (body.now !== undefined) {
      if (typeof body.now !== "string" || !Number.isFinite(Date.parse(body.now))) {
        throw new AdapterError("invalid now", 400);
      }
      now = new Date(body.now);
    }
    const { revoked } = await expireDevReleases(serviceClient(), now);
    return Response.json({ ok: true, revoked });
  } catch (error) {
    const mapped = adapterErrorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
