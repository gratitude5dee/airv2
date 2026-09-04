/**
 * V11 §10 Lane C `GET /api/create/github` — the owner's GitHub state for the
 * Create surface: whether the App is configured at all, the installations
 * they connected, and the repositories currently feeding apps. Metadata
 * only; no token is ever in this response (nothing token-shaped is stored).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { githubAppConfigured } from "@/lib/github/app";
import { installationsFor, linksFor } from "@/lib/create/import";
import { importErrorResponse } from "@/lib/create/import-errors";
import { nestedPathFor } from "@/lib/miniapps/nested";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const configured = githubAppConfigured();
  if (!configured) {
    return NextResponse.json({ ok: true, configured: false, installations: [], links: [] });
  }
  const supabase = serviceClient();
  try {
    const [installations, links] = await Promise.all([
      installationsFor(supabase, userId),
      linksFor(supabase, userId),
    ]);
    const appIds = links.map((link) => link.app_id);
    const slugs = new Map<string, string>();
    if (appIds.length > 0) {
      const { data } = await supabase.from("mini_apps").select("id, slug").in("id", appIds);
      for (const row of (data ?? []) as { id: string; slug: string }[]) slugs.set(row.id, row.slug);
    }
    return NextResponse.json({
      ok: true,
      configured: true,
      installations: installations.map((row) => ({
        installation_id: row.installation_id,
        account_login: row.account_login,
        account_type: row.account_type,
        suspended: row.suspended_at !== null,
      })),
      links: links.map((link) => {
        const slug = slugs.get(link.app_id) ?? null;
        return {
          slug,
          url: slug ? nestedPathFor(slug) : null,
          full_name: link.full_name,
          branch: link.branch,
          dir: link.dir,
          mode: link.mode,
          workflow_path: link.workflow_path,
          last_sha: link.last_sha,
          last_synced_at: link.last_synced_at,
          last_error: link.last_error,
        };
      }),
    });
  } catch (error) {
    const mapped = importErrorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
