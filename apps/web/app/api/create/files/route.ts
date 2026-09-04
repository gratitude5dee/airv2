/**
 * V11 §14.1 `GET|PUT /api/create/files?app=&path=` — the Project tab's
 * Files view. Reads and writes one text file inside the owner's workspace
 * on their Box (`~/.hermes/create/<appname>/`), through the compute helpers
 * the rest of the control plane uses. Workspace-rooted and traversal-safe:
 * only `air.json`, `create.plan.md`, `src/**` and `public/**` resolve, and
 * a file is at most 512 KiB (the Build Service's own source cap). `GET`
 * without `path` lists the tree (paths and sizes). Nothing is persisted on
 * this side — the workspace stays in the Box (CR14).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { PublishError, validateAppName } from "@/lib/miniapps/publish";
import { StartLimitError, ensureBoxAwake, armStopAfter } from "@/lib/orchestrator/boxes";
import { loadTarget, readComputeFile, writeComputeFile } from "@/lib/compute/runtime";
import { BoxApiError } from "@/lib/box/client";
import {
  BuildError,
  SOURCE_MAX_BYTES,
  listWorkspace,
  safeWorkspacePath,
  workspacePath,
} from "@/lib/create/build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXT_EXT_RE = /\.(tsx?|jsx?|css|json|md|txt|html|svg|csv)$/;

interface Resolved {
  userId: string;
  appname: string;
  relative: string;
  boxPath: string;
}

function resolveApp(request: NextRequest): { userId: string; appname: string } | NextResponse {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const appname = validateAppName(request.nextUrl.searchParams.get("app") ?? "");
    return { userId, appname };
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

function resolve(request: NextRequest): Resolved | NextResponse {
  const app = resolveApp(request);
  if (app instanceof NextResponse) return app;
  const { userId, appname } = app;
  const raw = request.nextUrl.searchParams.get("path") ?? "";
  const relative = raw.length <= 512 ? safeWorkspacePath(raw) : null;
  if (!relative || relative.endsWith("/") || !TEXT_EXT_RE.test(relative)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  return { userId, appname, relative, boxPath: `${workspacePath(appname)}/${relative}` };
}

function failure(error: unknown): NextResponse {
  if (error instanceof BoxApiError && error.status === 404) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
  if (error instanceof StartLimitError) {
    return NextResponse.json({ error: "busy" }, { status: 429 });
  }
  if (error instanceof BuildError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

async function list(request: NextRequest): Promise<NextResponse> {
  const app = resolveApp(request);
  if (app instanceof NextResponse) return app;
  const supabase = serviceClient();
  try {
    await ensureBoxAwake(supabase, app.userId);
    try {
      const target = await loadTarget(supabase, app.userId);
      const files = await listWorkspace(target, app.appname);
      return NextResponse.json({ app: app.appname, files });
    } finally {
      await armStopAfter(supabase, app.userId).catch(() => undefined);
    }
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!request.nextUrl.searchParams.has("path")) return list(request);
  const resolved = resolve(request);
  if (resolved instanceof NextResponse) return resolved;
  const supabase = serviceClient();
  try {
    await ensureBoxAwake(supabase, resolved.userId);
    try {
      const target = await loadTarget(supabase, resolved.userId);
      const content = await readComputeFile(target, resolved.boxPath);
      if (Buffer.byteLength(content, "utf8") > SOURCE_MAX_BYTES) {
        return NextResponse.json({ error: "file too large" }, { status: 413 });
      }
      return NextResponse.json({ app: resolved.appname, path: resolved.relative, content });
    } finally {
      await armStopAfter(supabase, resolved.userId).catch(() => undefined);
    }
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const resolved = resolve(request);
  if (resolved instanceof NextResponse) return resolved;
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  if (!body || typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (body.content.includes("\0")) {
    return NextResponse.json({ error: "text files only" }, { status: 400 });
  }
  const bytes = Buffer.byteLength(body.content, "utf8");
  if (bytes > SOURCE_MAX_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  const supabase = serviceClient();
  try {
    await ensureBoxAwake(supabase, resolved.userId);
    try {
      const target = await loadTarget(supabase, resolved.userId);
      await writeComputeFile(target, resolved.boxPath, body.content);
      return NextResponse.json({ ok: true, app: resolved.appname, path: resolved.relative, bytes });
    } finally {
      await armStopAfter(supabase, resolved.userId).catch(() => undefined);
    }
  } catch (error) {
    return failure(error);
  }
}
