/**
 * V11 §14.1 `/api/create/import` — Lane C entry for the owner on the Create
 * surface (store session).
 *
 *   POST {installation_id, full_name, branch?, dir?, appname?, preview: true}
 *        → the Repo Scan plan (and the workflow file a build would commit);
 *          creates and writes nothing.
 *   POST {…, confirm_workflow?: true}
 *        → link the repository to an owned app; static trees stage a draft
 *          now, projects that build get the workflow committed (only with
 *          confirm_workflow, the owner's answer to the preview) and stage
 *          on their first Actions run. Draft only (CR9).
 *   GET  → the owner's links (same shape as /api/create/github).
 *   DELETE ?slug= → unlink; the app and its versions stay.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { ownedApp } from "@/lib/miniapps/publish";
import { githubAppConfigured } from "@/lib/github/app";
import {
  linkRepository,
  linksFor,
  previewRepository,
  unlinkRepo,
  type LinkInput,
} from "@/lib/create/import";
import { importErrorResponse } from "@/lib/create/import-errors";
import { r2Configured } from "@/lib/storage/r2";
import { importRateLimited, recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseLink(body: Record<string, unknown> | null): LinkInput | null {
  const installationId = Number(body?.["installation_id"]);
  const fullName = text(body?.["full_name"]);
  if (!Number.isSafeInteger(installationId) || installationId <= 0 || !fullName) return null;
  return {
    installationId,
    fullName,
    branch: text(body?.["branch"]),
    dir: text(body?.["dir"]),
    appname: text(body?.["appname"]),
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!githubAppConfigured()) {
    return NextResponse.json({ error: "github import is not available" }, { status: 503 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "bundle storage unavailable" }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const input = parseLink(body);
  if (!input) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const supabase = serviceClient();
  if (await importRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many imports today" }, { status: 429 });
  }
  try {
    if (body?.["preview"] === true) {
      const plan = await previewRepository(supabase, userId, input);
      return NextResponse.json({ ok: true, ...plan });
    }
    const result = await linkRepository(supabase, userId, {
      ...input,
      commitWorkflow: body?.["confirm_workflow"] === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const mapped = importErrorResponse(error);
    if (mapped) {
      if (mapped.status === 400 || mapped.status === 413) {
        await recordOpsEvent(supabase, "upload_rejected", userId, `import:${input.fullName}`);
      }
      return mapped;
    }
    throw error;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = serviceClient();
  try {
    const links = await linksFor(supabase, userId);
    return NextResponse.json({ ok: true, links });
  } catch (error) {
    const mapped = importErrorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const supabase = serviceClient();
  try {
    const app = await ownedApp(supabase, userId, slug);
    const removed = await unlinkRepo(supabase, userId, app.id);
    if (!removed) return NextResponse.json({ error: "not linked" }, { status: 404 });
    return NextResponse.json({ ok: true, slug: app.slug });
  } catch (error) {
    const mapped = importErrorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
