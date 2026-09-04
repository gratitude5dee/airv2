/**
 * `GET /api/create/github/repos?installation=<id>` — the repositories one of
 * the owner's installations grants, for the picker. The installation token
 * minted for the listing is `metadata:read` only and dies with the request.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { listInstallationRepositories } from "@/lib/github/app";
import { installationById } from "@/lib/create/import";
import { importErrorResponse } from "@/lib/create/import-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const installationId = Number(request.nextUrl.searchParams.get("installation"));
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return NextResponse.json({ error: "installation required" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const installation = await installationById(supabase, installationId);
    if (!installation || installation.user_id !== userId || installation.removed_at) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (installation.suspended_at) {
      return NextResponse.json({ error: "installation suspended" }, { status: 409 });
    }
    const { repositories, truncated } = await listInstallationRepositories(installationId);
    return NextResponse.json({
      ok: true,
      truncated,
      repositories: repositories
        .filter((repo) => !repo.archived)
        .map((repo) => ({
          id: repo.id,
          full_name: repo.full_name,
          private: repo.private,
          default_branch: repo.default_branch,
        })),
    });
  } catch (error) {
    const mapped = importErrorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
