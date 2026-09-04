/**
 * V11 §14.1 `POST /api/create/drop` — Lane A entry. Two callers, one pipeline
 * (lib/create/drop.ts):
 *
 *  (a) the owner on the Create surface: store session + multipart
 *      (`file`, optional `appname`/`name`/`description`), same cap, limit,
 *      and error shapes as `/api/mini/publish/bundle`;
 *  (b) the owner's Box: gateway bearer + JSON `{ path, appname?, ... }`. The
 *      control plane pulls the bytes FROM the Box over the command channel,
 *      capped, with the same `BOX_PATH_RE` discipline as `/api/media/publish`
 *      — the Box never holds an R2 credential and never writes a bundle
 *      itself (CR6, C16).
 *
 * Either way the result is a staged draft: `{slug, version, preview_url,
 * findings}`. Nothing here publishes (CR9). Hard CSP findings come back as a
 * one-line 400 (CR12); soft ones ride along on the version row.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import { command } from "@/lib/box/client";
import { isBoxPath } from "@/lib/box/paths";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { PublishError } from "@/lib/miniapps/publish";
import { BUNDLE_MAX_ZIP_BYTES, BundleError } from "@/lib/miniapps/bundles";
import { VersionError } from "@/lib/create/versions";
import { LintError } from "@/lib/create/lint";
import { dropBundle, type DropFile, type DropResult } from "@/lib/create/drop";
import { r2Configured } from "@/lib/storage/r2";
import { dropRateLimited, recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Pull a Box file over the command channel, base64-encoded, hard-capped. */
async function pullBoxFile(boxId: string, path: string): Promise<Buffer> {
  // head -c cap+1 makes an oversized file detectable without buffering it
  // all; pipefail so a missing/unreadable file fails the pipeline.
  const result = await command(
    boxId,
    `set -o pipefail; head -c ${BUNDLE_MAX_ZIP_BYTES + 1} ${JSON.stringify(path)} | base64 -w0`,
    180
  );
  if (result.exitCode !== 0) {
    throw new BundleError(`file not readable: ${path}`, 404);
  }
  const bytes = Buffer.from(result.stdout.trim(), "base64");
  if (bytes.length > BUNDLE_MAX_ZIP_BYTES) {
    throw new BundleError("bundle too large", 413);
  }
  return bytes;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

interface DropRequest {
  userId: string;
  file: DropFile;
  appname?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  via: "session" | "box";
}

type Rejection = { error: string; status: number };

/** Owner multipart entry (a). */
async function fromSession(
  request: NextRequest,
  userId: string
): Promise<DropRequest | Rejection> {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file") ?? form?.get("bundle");
  if (!(file instanceof File)) return { error: "invalid request", status: 400 };
  if (file.size > BUNDLE_MAX_ZIP_BYTES) return { error: "bundle too large", status: 413 };
  return {
    userId,
    file: { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) },
    appname: text(form?.get("appname")),
    name: text(form?.get("name")),
    description: text(form?.get("description")),
    via: "session",
  };
}

/** Box entry (b): validated path first, bytes pulled later inside the guard. */
async function fromBox(
  request: NextRequest,
  userId: string
): Promise<(Omit<DropRequest, "file"> & { path: string }) | Rejection> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const path = typeof body?.["path"] === "string" ? body["path"] : "";
  if (!isBoxPath(path)) {
    return { error: "invalid path", status: 400 };
  }
  return {
    userId,
    path,
    appname: text(body?.["appname"]),
    name: text(body?.["name"]),
    description: text(body?.["description"]),
    via: "box",
  };
}

function isRejection(value: object): value is Rejection {
  return "error" in value;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const sessionUser = storeSessionUserId(request);
  const boxUser = sessionUser ? null : await boxUserId(supabase, request);
  const userId = sessionUser ?? boxUser;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "bundle storage unavailable" }, { status: 503 });
  }
  const input = sessionUser
    ? await fromSession(request, userId)
    : await fromBox(request, userId);
  if (isRejection(input)) {
    if (input.status === 400) {
      await recordOpsEvent(supabase, "upload_rejected", userId, input.error);
    }
    return NextResponse.json({ error: input.error }, { status: input.status });
  }
  if (await dropRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many uploads" }, { status: 429 });
  }
  try {
    let file: DropFile;
    if ("path" in input) {
      const box = await ensureBoxAwake(supabase, userId);
      file = {
        name: input.path.slice(input.path.lastIndexOf("/") + 1),
        bytes: await pullBoxFile(box.boxId, input.path),
      };
    } else {
      file = input.file;
    }
    const result: DropResult = await dropBundle(supabase, userId, {
      appname: input.appname,
      name: input.name,
      description: input.description,
      file,
    });
    await recordOpsEvent(
      supabase,
      "create.drop",
      userId,
      `${input.via}:${result.slug}`,
      file.bytes.length
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (
      error instanceof PublishError ||
      error instanceof BundleError ||
      error instanceof LintError ||
      error instanceof VersionError
    ) {
      if (error instanceof BundleError || error instanceof LintError) {
        await recordOpsEvent(supabase, "upload_rejected", userId, error.message);
      }
      return NextResponse.json(
        {
          error: error.message,
          ...(error instanceof LintError ? { findings: error.findings } : {}),
        },
        { status: error.status }
      );
    }
    throw error;
  }
}
