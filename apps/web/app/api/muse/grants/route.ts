import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { createMuseGrant } from "@/lib/muse/link";
import { normalizeMuseScopes } from "@/lib/muse/contracts";
import { writeConnectedToolsFile } from "@/lib/provisioning/connectors";
import { guardResponse, requireWorker } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const Body = z.object({
  user_id: z.string().uuid(),
  client_id: z.string().min(1).max(512),
  client_name: z.string().max(160).nullable().optional(),
  scopes: z.array(z.string()).max(12),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireWorker(request, "muse").catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const scopes = normalizeMuseScopes(parsed.data.scopes);
  if (!scopes.includes("profile")) return NextResponse.json({ error: "profile_scope_required" }, { status: 400 });
  try {
    const grant = await createMuseGrant(serviceClient(), {
      userId: parsed.data.user_id,
      clientId: parsed.data.client_id,
      clientName: parsed.data.client_name ?? null,
      scopes,
    });
    // This is a capability description, not a credential installation. A
    // failure to wake a stopped Box must not invalidate a completed OAuth
    // grant; the next normal connector refresh will reconcile it.
    after(() => writeConnectedToolsFile(serviceClient(), parsed.data.user_id).catch(() => undefined));
    return NextResponse.json({ grant_id: grant.id }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "grant_unavailable" }, { status: 502 });
  }
}
