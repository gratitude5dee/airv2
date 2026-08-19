/**
 * MA2.4 plugin discovery manifest: where a WZRD.Tech plugin (Codex / Claude
 * Code) starts device-code sign-in and polls for its bearer. Served on the
 * main origin; contains no secrets.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const origin = env.appOrigin();
  return NextResponse.json(
    {
      name: "WZRD.Tech",
      version: 1,
      device_authorization_endpoint: `${origin}/api/plugin/auth/start`,
      token_endpoint: `${origin}/api/plugin/auth/token`,
      verification_uri: `${origin}/home`,
      apps_api: `${env.miniappOrigin()}/api/mini/launch`,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
