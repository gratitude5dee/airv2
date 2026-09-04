/**
 * `GET /api/create/github/setup` — the App's "Setup URL". GitHub lands here
 * after install/update with `installation_id`, `setup_action` and the
 * `state` we sent from /connect. Nothing in the query string is trusted on
 * its own: the state must verify (and name the signed-in owner), and the
 * installation is re-read from GitHub with the App JWT before it is stored.
 * Then back to /create.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { getInstallation, GitHubError, verifySetupState } from "@/lib/github/app";
import { ImportError, recordInstallation } from "@/lib/create/import";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(outcome: string): NextResponse {
  const url = new URL("/create", env.miniappOrigin());
  url.searchParams.set("github", outcome);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionUser = storeSessionUserId(request);
  if (!sessionUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const stateUser = verifySetupState(params.get("state"));
  if (!stateUser || stateUser !== sessionUser) return back("state");
  const installationId = Number(params.get("installation_id"));
  if (!Number.isSafeInteger(installationId) || installationId <= 0) return back("invalid");
  const supabase = serviceClient();
  try {
    const installation = await getInstallation(installationId);
    await recordInstallation(supabase, sessionUser, installation);
    return back("connected");
  } catch (error) {
    if (error instanceof ImportError && error.status === 409) return back("taken");
    if (error instanceof GitHubError) return back("github");
    throw error;
  }
}
