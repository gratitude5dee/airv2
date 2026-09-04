/**
 * V11 §14.1 `POST /api/create/build` — Lane B's build step. The owner (store
 * session) or the owner's Box (gateway bearer, via `air-create build`) asks
 * the Build Service to compile `~/.hermes/create/<appname>/` into a draft
 * version. The control plane pulls the tree, resolves the Kit, bundles,
 * lints, validates and stages — the Box never runs npm and never holds an
 * R2 credential (§7.1, C16).
 *
 * The request is held for up to `HOLD_MS`; a build still running after that
 * answers `202 { build_id }` and finishes inside `after()`, with the
 * `create_builds` row the status route reports on. A hard finding produces
 * no version (§9.3); nothing here publishes (CR9).
 */
import { NextRequest, NextResponse, after } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import { validateAppName, PublishError } from "@/lib/miniapps/publish";
import {
  buildFailureMessage,
  hard,
  logTail,
  trackedBuild,
  BuildError,
  type BuildResult,
} from "@/lib/create/build";
import { r2Configured } from "@/lib/storage/r2";
import { buildRateLimited, recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** How long the request waits for the build before handing back a build id. */
const HOLD_MS = 60_000;

function hold(): { pending: Promise<"pending">; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Promise<"pending">((resolve) => {
    timer = setTimeout(() => resolve("pending"), HOLD_MS);
  });
  return { pending, cancel: () => clearTimeout(timer) };
}

function buildResponse(buildId: string, result: BuildResult) {
  return {
    ok: result.version !== null,
    build_id: buildId,
    slug: result.slug,
    appname: result.appname,
    version: result.version,
    preview_url: result.preview_url,
    url: result.url,
    findings: result.findings,
    sizes: result.sizes,
    log: logTail(result.log),
    hard: hard(result.findings).length,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const sessionUser = storeSessionUserId(request);
  const userId = sessionUser ?? (await boxUserId(supabase, request));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "bundle storage unavailable" }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { appname?: unknown } | null;
  let appname: string;
  try {
    appname = validateAppName(typeof body?.appname === "string" ? body.appname : "");
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  if (await buildRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many builds" }, { status: 429 });
  }
  const via = sessionUser ? "session" : "box";
  let build: { buildId: string; done: Promise<BuildResult> };
  try {
    build = await trackedBuild(supabase, userId, appname);
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const settled = build.done.then(
    async (result) => {
      await recordOpsEvent(
        supabase,
        "create.build",
        userId,
        `${via}:${result.slug}:${result.version ?? "no-version"}`,
        result.sizes.total
      );
      return result;
    },
    async (error: unknown) => {
      await recordOpsEvent(supabase, "create.build", userId, `${via}:${appname}:failed`);
      throw error;
    }
  );
  // Keep the promise alive past the hold: the ledger row is what the status
  // route reports, so an unobserved rejection here must not kill the build.
  after(() => settled.catch(() => undefined));
  const timer = hold();
  const outcome = await Promise.race([settled, timer.pending]).catch((error: unknown) => error);
  timer.cancel();
  if (outcome === "pending") {
    return NextResponse.json({ ok: false, build_id: build.buildId, status: "running" }, { status: 202 });
  }
  if (outcome instanceof Error) {
    const message = buildFailureMessage(outcome);
    if (message === null) throw outcome;
    const status = "status" in outcome && typeof outcome.status === "number" ? outcome.status : 400;
    return NextResponse.json(
      {
        error: message,
        build_id: build.buildId,
        ...(outcome instanceof BuildError ? { findings: outcome.findings } : {}),
      },
      { status }
    );
  }
  const result = outcome as BuildResult;
  return NextResponse.json(buildResponse(build.buildId, result), {
    status: result.version ? 200 : 400,
  });
}
