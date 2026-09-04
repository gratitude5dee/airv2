/**
 * `GET /api/create/github/connect` — send the signed-in owner to GitHub's
 * install screen for the WZRD App with a signed, 15-minute `state` naming
 * them. GitHub returns to /api/create/github/setup with that state, which is
 * the only thing binding the resulting installation to this account.
 */
import { NextRequest, NextResponse } from "next/server";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { githubAppConfigured, installUrl, signSetupState } from "@/lib/github/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest): NextResponse {
  const userId = storeSessionUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!githubAppConfigured()) {
    return NextResponse.json({ error: "github import is not available" }, { status: 503 });
  }
  return NextResponse.redirect(installUrl(signSetupState(userId)), 302);
}
