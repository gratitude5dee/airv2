/**
 * V12 §9 Finalize — the step between a dev release and the publish decision.
 *
 * The owner answers three things (name, description, icon) plus two switches
 * (`mirror`, `store`); the Planner parses their phrases in the Box and posts
 * the result to `POST /api/create/finalize`, which writes the metadata
 * through the same publisher helpers the Publish surface uses and files the
 * `miniapp_publish` decision with the V12 payload (§9.3). Nothing here flips
 * status: the owner's tap in `/api/mini/publish/status` does, and that route
 * calls `onPublishDecision` afterwards to list the app, advance the intake
 * and kick the mirror (§10) — never blocking the publish (CR20).
 *
 * `create_intakes` sees stage moves only; name and description already live
 * on `mini_apps` (V11), and the decision payload carries flags, counts and
 * platform-derived URLs — never owner prose beyond those two fields (CR21).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { asRecord } from "../records";
import { splitPublishedSlug } from "../miniapps/nested";
import {
  createDraft,
  ownedApp,
  resolveOwnedAppRef,
  publisherUsername,
  slugFor,
  validateAppName,
} from "../miniapps/publish";
import type { RegistryApp } from "../miniapps/registry";
import { recordOpsEvent, type OpsEventKind } from "../security/limits";
import { env } from "../env";
import { createConfig } from "./config";
import { advanceIntake, getIntake, IntakeError, type IntakeRow } from "./intake";
import { mirrorVersion } from "./mirror";
import { devUrl } from "./release";
import { getVersion, type VersionRow } from "./versions";

/* -------------------------------------------------------------- input */

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** §14.1 `POST /api/create/finalize` body. `app` is a slug or a bare appname. */
export const FinalizeInputSchema = z
  .object({
    app: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(NAME_MAX),
    description: z.string().trim().max(DESCRIPTION_MAX),
    icon_key: z.string().trim().min(1).max(256).optional(),
    mirror: z.boolean().default(true),
    store: z.enum(["listed", "unlisted"]).default("listed"),
  })
  .strict();
export type FinalizeInput = z.infer<typeof FinalizeInputSchema>;
export type StoreChoice = FinalizeInput["store"];

export class FinalizeError extends Error {
  readonly status: number;
  readonly reasons: string[];
  constructor(message: string, status = 400, reasons: string[] = []) {
    super(message);
    this.name = "FinalizeError";
    this.status = status;
    this.reasons = reasons;
  }
}

/* ------------------------------------------------------------ answers */

/** What `parseFinalizeAnswers` can read out of an owner's message. */
export interface FinalizeAnswers {
  /** "keep it": the plan's name and description stand. */
  keep?: boolean;
  mirror?: boolean;
  store?: StoreChoice;
  name?: string;
  description?: string;
}

const KEEP_RE = /^\s*(?:keep(?: it| them| the plan(?:'s)?(?: values)?| everything)?|same|as is|looks good|no changes?)\s*[.!]?\s*$/i;
const NO_MIRROR_RE =
  /\b(?:no mirror|don'?t mirror|do not mirror|skip the mirror|keep (?:the |my )?(?:code|source) private|(?:code|source) (?:stays |is )?private|private (?:code|source))\b/i;
const MIRROR_RE = /\b(?:mirror it|mirror(?: is)?(?::| =)? ?(?:yes|on|true)|(?:make|keep) (?:the |my )?(?:code|source) public|public (?:code|source))\b/i;
const UNLISTED_RE = /\b(?:unlisted|not listed|don'?t list(?: it)?|do not list(?: it)?|no store|off the store|out of the store)\b/i;
const LISTED_RE = /\b(?:list it|listed|in the store|on the store|to the store)\b/i;
const NAME_RE = /\b(?:call it|name it|name(?::| is| =)|title(?::| is| =)|called)\s+["“']?([^"”'\n,;]{1,80})["”']?/i;
const DESCRIPTION_RE = /\b(?:description|desc|tagline|blurb)(?::| is| =)\s*["“']?([^"”'\n]{1,200})["”']?/i;

/**
 * Pure: read the finalize switches out of an owner's phrase. Anything the
 * message does not say is left undefined so the caller keeps the plan's
 * values. "keep it" → `keep: true`; "no mirror" / "keep the code private" →
 * `mirror: false`; "unlisted" → `store: "unlisted"` (§9.3, §10.3).
 */
export function parseFinalizeAnswers(text: string): FinalizeAnswers {
  const out: FinalizeAnswers = {};
  const message = typeof text === "string" ? text.trim() : "";
  if (!message) return out;
  if (KEEP_RE.test(message)) out.keep = true;
  if (NO_MIRROR_RE.test(message)) out.mirror = false;
  else if (MIRROR_RE.test(message)) out.mirror = true;
  if (UNLISTED_RE.test(message)) out.store = "unlisted";
  else if (LISTED_RE.test(message)) out.store = "listed";
  const name = NAME_RE.exec(message)?.[1]?.trim();
  if (name) out.name = name.replace(/[.!]+$/, "").slice(0, NAME_MAX).trim();
  const description = DESCRIPTION_RE.exec(message)?.[1]?.trim();
  if (description) out.description = description.slice(0, DESCRIPTION_MAX).trim();
  if (out.name || out.description) delete out.keep;
  return out;
}

/* ------------------------------------------------------------ payload */

export const PUBLISH_DECISION_KIND = "miniapp_publish";

export interface PublishTests {
  passed: number;
  total: number;
}

/** The V12 decision payload (§9.3): V11 §5.4 lines plus the production fields. */
export interface PublishPayload {
  channel: "production";
  slug: string;
  name: string;
  description: string;
  version: string | null;
  bundle_sha256: string | null;
  bundle_bytes: number | null;
  file_count: number | null;
  kit_version: string | null;
  access: RegistryApp["access"];
  has_password: boolean;
  functions_enabled: boolean;
  store: StoreChoice;
  mirror: boolean;
  tests: PublishTests | null;
  qa_score: number | null;
  dev_url: string | null;
  production_url: string;
  /** §10.3 consent line (or the private-source line) the card renders. */
  mirror_line: string;
  store_line: string;
}

export interface PublishPayloadInput {
  app: RegistryApp;
  version?: VersionRow | null | undefined;
  tests?: PublishTests | null | undefined;
  qaScore?: number | null | undefined;
  devUrl?: string | null | undefined;
  store: StoreChoice;
  mirror: boolean;
  mirrorRepo?: string | undefined;
}

/** `https://mini.wzrd.tech/<u>/<a>` — the production URL for a slug. */
export function productionUrl(app: Pick<RegistryApp, "slug">): string {
  const parts = splitPublishedSlug(app.slug);
  const path = parts ? `/${parts.username}/${parts.appname}` : `/${app.slug}`;
  return `${env.miniappOrigin().replace(/\/+$/, "")}${path}`;
}

/** §10.3 decision line; the folder path is derived from the slug, never typed. */
export function mirrorConsentLine(app: Pick<RegistryApp, "slug">, repo = createConfig.mirrorRepo()): string {
  const parts = splitPublishedSlug(app.slug);
  const folder = parts ? `${parts.username}/${parts.appname}` : app.slug;
  return (
    `source → github.com/${repo}/apps/${folder} (public, MIT). ` +
    "say **no mirror** in finalize to keep it private."
  );
}

export const NO_MIRROR_LINE = "source stays private (no mirror).";

export function storeLine(store: StoreChoice): string {
  return store === "listed" ? "listed in the App Store" : "unlisted — link only, not in the store";
}

/**
 * Pure: the payload the owner sees on the decision card. Everything in it is
 * metadata the platform derived plus the name/description `mini_apps`
 * already stores (CR21).
 */
export function buildPublishPayload(input: PublishPayloadInput): PublishPayload {
  const { app, version } = input;
  const tests =
    input.tests ??
    (version && typeof version.tests_total === "number" && typeof version.tests_passed === "number"
      ? { passed: version.tests_passed, total: version.tests_total }
      : null);
  const qaScore = input.qaScore ?? version?.qa_score ?? null;
  return {
    channel: "production",
    slug: app.slug,
    name: app.name,
    description: app.description,
    version: version?.version ?? app.dev_version ?? app.draft_version ?? app.bundle_version ?? null,
    bundle_sha256: version?.bundle_sha256 ?? null,
    bundle_bytes: version?.bundle_bytes ?? null,
    file_count: version?.file_count ?? null,
    kit_version: version?.kit_version ?? app.kit_version ?? null,
    access: app.access,
    has_password: app.password_hash !== null,
    functions_enabled: app.functions_enabled,
    store: input.store,
    mirror: input.mirror,
    tests,
    qa_score: qaScore,
    dev_url: input.devUrl ?? (app.dev_version ? devUrl(app) : null),
    production_url: productionUrl(app),
    mirror_line: input.mirror ? mirrorConsentLine(app, input.mirrorRepo) : NO_MIRROR_LINE,
    store_line: storeLine(input.store),
  };
}

/** The V12 fields read back off a stored decision payload; null for a V11 row. */
export function parsePublishPayload(payload: unknown): Pick<PublishPayload, "store" | "mirror" | "version"> | null {
  const record = asRecord(payload);
  if (!record || record["channel"] !== "production") return null;
  return {
    store: record["store"] === "unlisted" ? "unlisted" : "listed",
    mirror: record["mirror"] !== false,
    version: typeof record["version"] === "string" ? record["version"] : null,
  };
}

/* ----------------------------------------------------------- decision */

/**
 * File (or refresh) the one pending `miniapp_publish` decision for an app —
 * shared by `POST /api/miniapps/publish` (the Box) and `applyFinalize`. Re-
 * staging refreshes the payload instead of piling up Needs-you items.
 */
export async function filePublishDecision(
  supabase: SupabaseClient,
  userId: string,
  app: Pick<RegistryApp, "slug" | "name">,
  payload: PublishPayload | null
): Promise<string> {
  const label = `Publish ${app.name} to the store`;
  const { data: pending } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", PUBLISH_DECISION_KIND)
    .eq("ref", app.slug)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    const id = pending.id as string;
    if (payload) {
      const { error } = await supabase.from("decisions").update({ payload, label }).eq("id", id);
      if (error) throw new FinalizeError("decision failed", 502);
    }
    return id;
  }
  const { data: decision, error } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: PUBLISH_DECISION_KIND,
      ref: app.slug,
      label,
      ...(payload ? { payload } : {}),
    })
    .select("id")
    .single();
  if (error || !decision) throw new FinalizeError("decision failed", 502);
  return decision.id as string;
}

/* ----------------------------------------------------------- finalize */

/**
 * `app` may be the flat `<u>-<a>` slug or a bare appname; both resolve to
 * the owner's row. F4 (V13 §9.2): the appname wins — a hyphenated name also
 * parses as a slug, so slug-first would shadow the app.
 */
export async function resolveOwnedSlug(supabase: SupabaseClient, userId: string, app: string): Promise<string> {
  const resolved = await resolveOwnedAppRef(supabase, userId, app);
  if (resolved) return resolved.slug;
  // Keep the historical error shape: a bad appname is a 400, a good one that
  // resolves to nothing is a 404 from ownedApp on the slug it made.
  const slug = slugFor(await publisherUsername(supabase, userId), validateAppName(app));
  return (await ownedApp(supabase, userId, slug)).slug;
}

export interface FinalizeResult {
  decision_id: string;
  stage: IntakeRow["stage"];
  store: StoreChoice;
  mirror: boolean;
}

const ICON_KEY_RE = /^apps\/[a-z0-9][a-z0-9_-]{0,63}\/icon\/[0-9a-f]{64}(?:-180)?\.png$/;

/**
 * §9.1: apply the owner's answers. The app must be theirs, have a dev
 * release and sit in `dev_ready` or `finalizing`; otherwise 409 `not_ready`
 * with reasons. Name/description go through `createDraft` (the Publish
 * surface's own refresh path), `icon_key` must be a key this lane minted,
 * then the decision is filed with the V12 payload and the intake moves to
 * `decision_sent`. Store/mirror live on the decision payload only.
 */
export async function applyFinalize(
  supabase: SupabaseClient,
  userId: string,
  input: FinalizeInput
): Promise<FinalizeResult> {
  const slug = await resolveOwnedSlug(supabase, userId, input.app);
  let app = await ownedApp(supabase, userId, slug);
  const appname = app.appname ?? splitPublishedSlug(app.slug)?.appname ?? null;
  if (!appname) throw new FinalizeError("not_ready", 409, ["no_appname"]);
  const intake = await getIntake(supabase, userId, appname);

  const reasons: string[] = [];
  if (!app.dev_version) reasons.push("no_dev_release");
  if (!intake) reasons.push("no_intake");
  else if (intake.stage !== "dev_ready" && intake.stage !== "finalizing") reasons.push(`stage:${intake.stage}`);
  if (reasons.length > 0 || !intake) throw new FinalizeError("not_ready", 409, reasons);
  if (input.icon_key !== undefined && !ICON_KEY_RE.test(input.icon_key)) {
    throw new FinalizeError("invalid icon_key", 400);
  }
  if (input.icon_key !== undefined && !input.icon_key.startsWith(`apps/${app.slug}/icon/`)) {
    throw new FinalizeError("icon_key belongs to another app", 400);
  }

  if (intake.stage === "dev_ready") {
    await advanceIntake(supabase, userId, appname, "ship", { app_id: app.id });
  }
  await createDraft(supabase, userId, {
    appname,
    name: input.name,
    description: input.description,
  });
  if (input.icon_key !== undefined) {
    const { error } = await supabase
      .from("mini_apps")
      .update({ icon_key: input.icon_key, updated_at: new Date().toISOString() })
      .eq("id", app.id)
      .eq("owner_user_id", userId);
    if (error) throw new FinalizeError("icon update failed", 502);
  }
  app = await ownedApp(supabase, userId, slug);
  const version = app.dev_version ? await getVersion(supabase, app.id, app.dev_version) : null;
  const payload = buildPublishPayload({
    app,
    version,
    store: input.store,
    mirror: input.mirror,
  });
  const decisionId = await filePublishDecision(supabase, userId, app, payload);
  const advanced = await advanceIntake(supabase, userId, appname, "finalize_complete");
  console.log(
    JSON.stringify({
      msg: "create finalize applied",
      user_id: userId,
      slug: app.slug,
      store: input.store,
      mirror: input.mirror,
      icon: input.icon_key !== undefined,
    })
  );
  return { decision_id: decisionId, stage: advanced.stage, store: input.store, mirror: input.mirror };
}

/* ----------------------------------------------------------- approval */

// 0117 admits the kind; the union in lib/security/limits.ts is another lane's file.
const MIRROR_KIND: OpsEventKind = "mirror";

export interface ResolvedPublishDecision {
  id: string;
  payload?: unknown;
}

export interface ApprovalOutcome {
  listed: boolean;
  mirrored: boolean;
  /** Short error class when the mirror was attempted and failed; never content. */
  mirror_error: string | null;
}

async function intakeFor(
  supabase: SupabaseClient,
  userId: string,
  app: RegistryApp
): Promise<{ appname: string; row: IntakeRow | null }> {
  const appname = app.appname ?? splitPublishedSlug(app.slug)?.appname ?? app.slug;
  try {
    return { appname, row: await getIntake(supabase, userId, appname) };
  } catch {
    return { appname, row: null };
  }
}

/** Short, content-free class for `create_intakes.mirror_error`. */
export function mirrorErrorClass(error: unknown): string {
  if (error instanceof Error) {
    const status = (error as { status?: unknown }).status;
    const name = error.name && error.name !== "Error" ? error.name : "mirror_failed";
    return typeof status === "number" ? `${name}:${status}`.slice(0, 80) : name.slice(0, 80);
  }
  return "mirror_failed";
}

/**
 * §9.3 after the owner's tap flipped status: list the app when the payload
 * says so, move the intake to `production`, then mirror (§10) when the
 * payload, the flag and the installation all say yes. Every leg is caught;
 * nothing here can throw out of the approval path (CR20: "never block the
 * publish"). A V11 decision (no `channel: production` payload) is left alone.
 */
export async function onPublishApproved(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  decision: ResolvedPublishDecision
): Promise<ApprovalOutcome> {
  const outcome: ApprovalOutcome = { listed: false, mirrored: false, mirror_error: null };
  const payload = parsePublishPayload(decision.payload);
  if (!payload) return outcome;
  let app: RegistryApp;
  try {
    app = await ownedApp(supabase, userId, slug);
  } catch {
    return outcome;
  }
  const now = new Date().toISOString();
  const { error: listError } = await supabase
    .from("mini_apps")
    .update(
      payload.store === "listed"
        ? { visibility: "public", listed_at: now, updated_at: now }
        : { visibility: "unlisted", updated_at: now }
    )
    .eq("id", app.id)
    .eq("owner_user_id", userId);
  outcome.listed = payload.store === "listed" && !listError;

  const { appname, row: intake } = await intakeFor(supabase, userId, app);
  if (intake && intake.stage === "decision_sent") {
    await advanceIntake(supabase, userId, appname, "approved").catch((error: unknown) => {
      if (!(error instanceof IntakeError)) throw error;
    });
  }

  if (!payload.mirror || !createConfig.mirrorEnabled() || !createConfig.mirrorInstallationId()) {
    return outcome;
  }
  const versionId = app.bundle_version ?? payload.version;
  const version = versionId ? await getVersion(supabase, app.id, versionId).catch(() => null) : null;
  try {
    if (!version) throw new FinalizeError("version_missing", 404);
    await mirrorVersion(supabase, app, version);
    outcome.mirrored = true;
  } catch (error) {
    const reason = mirrorErrorClass(error);
    outcome.mirror_error = reason;
    if (intake) {
      await supabase
        .from("create_intakes")
        .update({ mirror_error: reason.slice(0, 200), updated_at: new Date().toISOString() })
        .eq("id", intake.id);
    }
    await recordOpsEvent(supabase, MIRROR_KIND, userId, `${slug}:failed`).catch(() => undefined);
    console.error(
      JSON.stringify({ msg: "mirror failed after publish approval", user_id: userId, slug, reason })
    );
  }
  return outcome;
}

/** §9.3 decline → `dev_ready`, one line; a V11 decision or a closed intake is a no-op. */
export async function onPublishDeclined(supabase: SupabaseClient, userId: string, slug: string): Promise<void> {
  let app: RegistryApp;
  try {
    app = await ownedApp(supabase, userId, slug);
  } catch {
    return;
  }
  const { appname, row: intake } = await intakeFor(supabase, userId, app);
  if (intake && intake.stage === "decision_sent") {
    await advanceIntake(supabase, userId, appname, "declined").catch(() => undefined);
  }
}

/**
 * The one hook the status flip calls after settling pending decisions
 * (app/api/mini/publish/status). Errors are logged, never thrown.
 */
export async function onPublishDecision(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  outcome: "approved" | "declined",
  decisions: ResolvedPublishDecision[]
): Promise<void> {
  try {
    if (outcome === "declined") {
      await onPublishDeclined(supabase, userId, slug);
      return;
    }
    for (const decision of decisions) {
      await onPublishApproved(supabase, userId, slug, decision);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "publish decision hook failed",
        user_id: userId,
        slug,
        outcome,
        error: error instanceof Error ? error.name : "unknown",
      })
    );
  }
}
