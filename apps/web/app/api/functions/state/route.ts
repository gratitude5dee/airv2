/**
 * Runtime API (goal-create-v11 §11.3): GET/PUT the app's owner-side state
 * document `.hermes/miniapps/<slug>/<resource>.json`, the same store the
 * MA3 Apps API uses. Caller is the Outbound Worker with the app's runtime
 * token; owners write, everyone else reads. 256 KiB.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { readAppState, writeAppState } from "@/lib/miniapps/store";
import {
  handleRuntime,
  parseJson,
  readBoundedText,
  RESOURCE_RE,
  RuntimeApiError,
  runtimeJson,
  STATE_MAX_BYTES,
  type RuntimeCall,
} from "@/lib/functions/runtimeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function resourceOf(request: NextRequest): string {
  const resource = request.nextUrl.searchParams.get("resource") ?? "";
  if (!RESOURCE_RE.test(resource)) throw new RuntimeApiError(400, "invalid_resource");
  return resource;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  return handleRuntime(request, supabase, async (call: RuntimeCall) => {
    const resource = resourceOf(request);
    const state = await readAppState(
      supabase,
      call.principal.userId,
      call.principal.slug,
      resource
    );
    return runtimeJson({ state });
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  return handleRuntime(request, supabase, async (call: RuntimeCall) => {
    const resource = resourceOf(request);
    if (call.role !== "owner") throw new RuntimeApiError(403, "owner_only");
    const state = parseJson(await readBoundedText(request, STATE_MAX_BYTES));
    await writeAppState(
      supabase,
      call.principal.userId,
      call.principal.slug,
      resource,
      state
    );
    return runtimeJson({ ok: true });
  });
}
