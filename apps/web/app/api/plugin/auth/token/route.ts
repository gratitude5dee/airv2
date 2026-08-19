/**
 * MA2.4 device-code sign-in, step 3. The plugin polls {device_code}; once the
 * owner has approved the user code in Settings the poll mints a scoped bearer
 * (plugin_tokens, hashed at rest). Standard device-flow error codes.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { pollDeviceToken } from "@/lib/plugin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    device_code?: string;
  };
  if (!body.device_code) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const supabase = serviceClient();
  const result = await pollDeviceToken(supabase, body.device_code);
  if (result.status !== "ok") {
    return NextResponse.json(
      { error: result.status },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    { access_token: result.token, token_type: "Bearer", tool: result.tool },
    { headers: { "Cache-Control": "no-store" } }
  );
}
