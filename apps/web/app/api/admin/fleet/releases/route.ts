/**
 * Fleet releases: GET lists recent template releases; POST cuts a new one
 * from a packed infra/template tarball (see infra/template/release.sh). The
 * artifact is stored immutably in R2 and referenced by sha256.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import { cutRelease, listReleases, FleetError } from "@/lib/fleet/releases";
import { R2Error } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorResponse(error: unknown): NextResponse {
  if (error instanceof FleetError || error instanceof R2Error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "internal error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const releases = await listReleases(serviceClient());
    return NextResponse.json({ releases });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    version?: unknown;
    git_sha?: unknown;
    hermes_ref?: unknown;
    notes?: unknown;
    artifact_base64?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (
    typeof body.version !== "string" ||
    typeof body.git_sha !== "string" ||
    typeof body.artifact_base64 !== "string"
  ) {
    return NextResponse.json(
      { error: "version, git_sha, artifact_base64 required" },
      { status: 400 }
    );
  }
  try {
    const release = await cutRelease(serviceClient(), {
      version: body.version,
      gitSha: body.git_sha,
      artifactBase64: body.artifact_base64,
      hermesRef: typeof body.hermes_ref === "string" ? body.hermes_ref : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return NextResponse.json({ release }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
