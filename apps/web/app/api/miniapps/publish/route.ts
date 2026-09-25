/**
 * MA3 miniapp_publish backing tool (gateway-token auth, same pattern as
 * /api/browser/social). The agent can STAGE: create/refresh a draft registry
 * row and file a miniapp_publish Needs-you decision. It can never flip
 * status — that update exists only behind the owner's store session
 * (/api/mini/publish/status). Approving the decision points the owner at
 * the Publish surface where the flip happens under their session.
 *
 * V12 §9.3: the body may carry the production fields — `channel`
 * ("production"), `store` ("listed" | "unlisted"), `mirror`, `tests`
 * (`air-create test` results; only the counts are kept), `qa_score`,
 * `dev_url` — which land on the decision payload the owner sees.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { createDraft, ownedApp, PublishError } from "@/lib/miniapps/publish";
import { fileBackendDecision, loadFunctions } from "@/lib/functions/backend";
import { env } from "@/lib/env";
import { TestResultsSchema } from "@/lib/create/tests";
import { getVersion } from "@/lib/create/versions";
import { buildPublishPayload, filePublishDecision } from "@/lib/create/finalize";
import { guardResponse, requireBox } from "@/lib/auth/guard";

/** Counts-only tests shape (§9.3) or the full `air-create test` result. */
const TestCountsSchema = z
  .object({ total: z.number().int().min(0).max(40), passed: z.number().int().min(0).max(40) })
  .strict()
  .refine((tests) => tests.passed <= tests.total, { message: "passed cannot exceed total", path: ["passed"] });

const V12FieldsSchema = z
  .object({
    channel: z.literal("production").default("production"),
    store: z.enum(["listed", "unlisted"]).default("listed"),
    mirror: z.boolean().default(true),
    tests: z.union([TestResultsSchema, TestCountsSchema]).optional(),
    qa_score: z.number().min(0).max(100).optional(),
    dev_url: z
      .string()
      .url()
      .max(512)
      .refine((url) => url.startsWith(`${env.linkappOrigin()}/`), { message: "dev_url must be on the dev host" })
      .optional(),
  })
  .passthrough();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;


export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await requireBox(supabase, request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  const body = (await request.json().catch(() => null)) as {
    appname?: unknown;
    name?: unknown;
    description?: unknown;
    agentIdentity?: unknown;
  } | null;
  const v12 = V12FieldsSchema.safeParse(body ?? {});
  if (!v12.success) {
    return NextResponse.json(
      {
        error: "invalid request",
        issues: v12.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 }
    );
  }
  try {
    const app = await createDraft(supabase, userId, {
      appname: typeof body?.appname === "string" ? body.appname : "",
      name: typeof body?.name === "string" ? body.name : "",
      description: typeof body?.description === "string" ? body.description : "",
      ...(typeof body?.agentIdentity === "string"
        ? { agentIdentity: body.agentIdentity }
        : {}),
    });
    // One pending decision per app: re-staging refreshes the draft (and the
    // V12 payload) but must not pile up duplicate Needs-you items.
    const full = await ownedApp(supabase, userId, app.slug);
    const versionId = full.dev_version ?? full.draft_version ?? full.bundle_version;
    const version = versionId ? await getVersion(supabase, full.id, versionId) : null;
    const payload = buildPublishPayload({
      app: full,
      version,
      store: v12.data.store,
      mirror: v12.data.mirror,
      ...(v12.data.tests ? { tests: { passed: v12.data.tests.passed, total: v12.data.tests.total } } : {}),
      ...(v12.data.qa_score !== undefined ? { qaScore: v12.data.qa_score } : {}),
      ...(v12.data.dev_url !== undefined ? { devUrl: v12.data.dev_url } : {}),
    });
    let decisionId: string;
    try {
      decisionId = await filePublishDecision(supabase, userId, app, payload);
    } catch {
      return NextResponse.json({ error: "decision failed" }, { status: 502 });
    }
    // MC5 (V11 §4.1): a declared backend the approved manifest does not
    // cover yet needs its own owner decision alongside the publish one.
    const backend = await loadFunctions(supabase, app.id);
    const backendDecisionId = backend
      ? await fileBackendDecision(supabase, { ...app, owner_user_id: userId }, backend)
      : null;
    return NextResponse.json({
      ok: true,
      slug: app.slug,
      status: "draft",
      decision_id: decisionId,
      backend_decision_id: backendDecisionId,
      note: backendDecisionId
        ? "Draft staged. Publishing and the backend changes are owner decisions in Needs-you / the Publish page."
        : "Draft staged. Publishing is an owner decision in Needs-you / the Publish page.",
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
