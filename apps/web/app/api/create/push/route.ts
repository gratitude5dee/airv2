/**
 * V11 §14.1 `POST /api/create/push` — Lane C, build mode. The linked
 * repository's own GitHub Actions run POSTs the zip it built, authenticated
 * with an Actions OIDC token for our audience (no stored secret on either
 * side). The token's claims must match a `build` link exactly: repository
 * id, branch (`ref`), and the workflow file Import committed
 * (`job_workflow_ref`) — a fork, another branch, or a hand-edited workflow
 * path on the same repo is refused. The zip then goes through the same
 * validate → lint → uploadVersion path as a drop, as a draft (CR9).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { OidcError, verifyActionsToken } from "@/lib/github/oidc";
import { linksForRepo, matchBuildLink, pushBuildOutput } from "@/lib/create/import";
import { importErrorResponse } from "@/lib/create/import-errors";
import { BUNDLE_MAX_ZIP_BYTES } from "@/lib/miniapps/bundles";
import { r2Configured } from "@/lib/storage/r2";
import { pushRateLimited, recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let claims;
  try {
    claims = await verifyActionsToken(token);
  } catch (error) {
    if (error instanceof OidcError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "bundle storage unavailable" }, { status: 503 });
  }
  const supabase = serviceClient();
  const repoId = Number(claims.repository_id);
  const links = Number.isSafeInteger(repoId) ? await linksForRepo(supabase, repoId) : [];
  const link = matchBuildLink(links, claims);
  if (!link) return NextResponse.json({ error: "no build link for this workflow" }, { status: 404 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > BUNDLE_MAX_ZIP_BYTES) {
    return NextResponse.json({ error: "bundle too large" }, { status: 413 });
  }
  if (await pushRateLimited(supabase, link.user_id)) {
    return NextResponse.json({ error: "too many uploads" }, { status: 429 });
  }
  const zip = Buffer.from(await request.arrayBuffer());
  if (zip.length > BUNDLE_MAX_ZIP_BYTES) {
    await recordOpsEvent(supabase, "upload_rejected", link.user_id, "push:too large");
    return NextResponse.json({ error: "bundle too large" }, { status: 413 });
  }
  try {
    const result = await pushBuildOutput(supabase, link, zip, claims.sha);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const mapped = importErrorResponse(error);
    if (mapped) {
      if (mapped.status === 400 || mapped.status === 413) {
        await recordOpsEvent(supabase, "upload_rejected", link.user_id, `push:${link.full_name}`);
      }
      return mapped;
    }
    throw error;
  }
}
