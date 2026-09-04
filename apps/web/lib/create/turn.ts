/**
 * A Create turn (goal-create-v11 §9.2): one owner prompt into the app's own
 * Hermes session `air-create-<appname>` on the owner's existing Box. The
 * run pins `model: "create-<tier>"` — a tier name, never a slug (C2) — and
 * carries the Kit's generated system prompt plus a small project context
 * as instructions. The agent_runs row is labelled `create:<slug>` so the
 * gateway can attribute every completion of the turn to the project's
 * budget (§9.1). Nothing here reads the workspace or the Kit's source.
 */
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { CREATE_SESSION_PREFIX } from "../chat/relay";
import { createRun, ensureSession, stopRun } from "../hermes/client";
import { isSpeedTier, type SpeedTier } from "../entitlements/models";
import {
  PublishError,
  validateAppName,
} from "../miniapps/publish";
import type { RegistryApp } from "../miniapps/registry";
import { kitRoot, kitVersion } from "./kit";
import { openCreateRun } from "./budget";
import { discardEmptyDraft, resolveOrCreateDropApp } from "./drop";
import { WORKSPACE_ROOT } from "./build";

/** `air-create-<appname>` — the per-app thread inside air-main's namespace. */
export const CREATE_SESSION_RE = /^air-create-[a-z0-9-]{1,48}$/;
export { CREATE_SESSION_PREFIX };
export const PROMPT_MAX_CHARS = 8_000;
const CLOSE_ROW_ATTEMPTS = 3;
const CLOSE_ROW_BACKOFF_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSessionId(appname: string): string {
  const id = `${CREATE_SESSION_PREFIX}${validateAppName(appname)}`;
  if (!CREATE_SESSION_RE.test(id)) throw new PublishError("invalid app name");
  return id;
}

/** The appname behind a Create session id, or null when it is not one. */
export function appnameFromSession(sessionId: string): string | null {
  if (!CREATE_SESSION_RE.test(sessionId)) return null;
  return sessionId.slice(CREATE_SESSION_PREFIX.length);
}

let cachedPrompt: { file: string; text: string } | null = null;

/** The Kit's generated agent system prompt (never hand-edited here). */
export function createSystemPrompt(root: string = kitRoot()): string {
  const file = path.join(root, "prompts", "create-agent.system.md");
  if (cachedPrompt?.file === file) return cachedPrompt.text;
  const text = fs.readFileSync(file, "utf8");
  cachedPrompt = { file, text };
  return text;
}

export interface ProjectContext {
  appname: string;
  slug: string;
  lane: RegistryApp["lane"];
  status: RegistryApp["status"];
  draftVersion: string | null;
  liveVersion: string | null;
  kitVersion: string;
  budget: { budget_usd: number; spent_usd: number } | null;
}

/**
 * Turn-time project context appended to the system prompt: metadata the
 * Box cannot see on its own (registry state, budget), plus the workspace
 * path and the rules the agent must not cross (§9.7).
 */
export function projectContext(ctx: ProjectContext): string {
  const lines = [
    "# Project",
    `- appname: ${ctx.appname}`,
    `- slug: ${ctx.slug}`,
    `- lane: ${ctx.lane}`,
    `- status: ${ctx.status} (you never change this; the owner decides on the surface)`,
    `- workspace: ~/${WORKSPACE_ROOT}/${ctx.appname}/ (air.json, create.plan.md, src/, public/)`,
    `- draft version: ${ctx.draftVersion ?? "none yet"}`,
    `- live version: ${ctx.liveVersion ?? "none"}`,
    `- kit version: ${ctx.kitVersion} (imports only from @kit/* and the Kit's approved packages; never npm install)`,
  ];
  if (ctx.budget) {
    lines.push(
      `- budget: $${ctx.budget.spent_usd.toFixed(2)} of $${ctx.budget.budget_usd.toFixed(2)} spent (only the owner raises it)`
    );
  }
  lines.push(
    "",
    "Build with `air-create build " + ctx.appname + "`, check with `air-create qa " +
      ctx.appname +
      "`. Report in one line plus `[card: app " +
      ctx.slug +
      "]`; drafts are \"ready for your approval\", never \"published\"."
  );
  return lines.join("\n");
}

export function createInstructions(ctx: ProjectContext): string {
  return `${createSystemPrompt().trimEnd()}\n\n${projectContext(ctx)}\n`;
}

export interface TurnInput {
  appname: string;
  /** Raw prompt; validated by `normalizePrompt`. */
  input: unknown;
  /** Owner's requested tier; the gateway clamps it to the entitlement. */
  tier?: string | undefined;
  trigger?: "web" | "imessage" | undefined;
}

export interface TurnResult {
  run_id: string;
  session: string;
  slug: string;
  appname: string;
  tier: SpeedTier;
}

export function normalizePrompt(input: unknown): string {
  if (typeof input !== "string") throw new PublishError("prompt required");
  const text = input.trim();
  if (!text) throw new PublishError("prompt required");
  if (text.length > PROMPT_MAX_CHARS) {
    throw new PublishError("prompt too long", 413);
  }
  return text;
}

/**
 * Start a turn: ensure the app exists as the owner's draft (lane vibe when
 * new), open the labelled agent_runs row the gateway attributes `create-*`
 * spend to, then ensure the Box session and create the run. The row exists
 * before Hermes can issue its first completion — a run that starts without
 * it would be refused (`create_run_required`) or spend unattributed — so a
 * turn whose row cannot be written does not start, and a run that fails to
 * start (or whose id cannot be linked to the row) closes its row again. A
 * row that could not be closed either is retired by the next open attempt
 * once it has sat unlinked past CREATE_RUN_LINK_GRACE_MINUTES.
 */
export async function startCreateTurn(
  supabase: SupabaseClient,
  userId: string,
  input: TurnInput,
  context: Omit<ProjectContext, "appname" | "slug" | "lane" | "status" | "draftVersion" | "liveVersion" | "kitVersion">
): Promise<TurnResult> {
  const appname = validateAppName(input.appname);
  const prompt = normalizePrompt(input.input);
  const tier: SpeedTier =
    input.tier && isSpeedTier(input.tier) ? input.tier : "balanced";
  const { app, created } = await resolveOrCreateDropApp(supabase, userId, { appname }, "vibe");
  const session = createSessionId(appname);
  // One open Create run per owner: the gateway attributes `create-*` spend
  // to the open run, so a second project may not start until it closes.
  const opened = await openCreateRun(supabase, userId, app.slug, input.trigger ?? "web");
  if (!opened) {
    if (created) await discardEmptyDraft(supabase, userId, app.id);
    throw new PublishError("could not open the Create run; try again", 503);
  }
  if (opened.id === null) {
    if (created) await discardEmptyDraft(supabase, userId, app.id);
    throw new PublishError(
      "another Create project is still running; wait for it to finish",
      409
    );
  }
  const rowId = opened.id;
  const closeRow = async (): Promise<void> => {
    for (let attempt = 0; attempt < CLOSE_ROW_ATTEMPTS; attempt += 1) {
      const { error } = await supabase
        .from("agent_runs")
        .update({ ended_at: new Date().toISOString(), outcome: "failed" })
        .eq("id", rowId)
        .is("ended_at", null);
      if (!error) return;
      if (attempt + 1 < CLOSE_ROW_ATTEMPTS) await sleep(CLOSE_ROW_BACKOFF_MS * (attempt + 1));
    }
    console.error(JSON.stringify({ msg: "create run close failed", user_id: userId, row_id: rowId }));
  };
  let box: Awaited<ReturnType<typeof ensureBoxAwake>>;
  try {
    box = await ensureBoxAwake(supabase, userId);
  } catch (error) {
    await closeRow();
    throw error;
  }
  try {
    let run: Awaited<ReturnType<typeof createRun>>;
    try {
      await ensureSession(box.target, session, `Create · ${app.name}`);
      run = await createRun(box.target, {
        input: prompt,
        sessionId: session,
        model: `create-${tier}`,
        instructions: createInstructions({
          appname,
          slug: app.slug,
          lane: app.lane,
          status: app.status,
          draftVersion: app.draft_version,
          liveVersion: app.status === "published" ? app.bundle_version : null,
          kitVersion: kitVersion(),
          budget: context.budget,
        }),
        metadata: { app: "create", resource: appname, surface: "miniapp" },
      });
    } catch (error) {
      await closeRow();
      throw error;
    }
    // The events relay closes the row by hermes_run_id; a row left unlinked
    // would stay open (blocking the owner's other projects) until it ages
    // out, so an unlinkable run is stopped and its row closed instead.
    const { error: linkError } = await supabase
      .from("agent_runs")
      .update({ hermes_run_id: run.run_id })
      .eq("id", rowId);
    if (linkError) {
      console.error(
        JSON.stringify({ msg: "create run link failed", user_id: userId, run_id: run.run_id, error: linkError.message })
      );
      await stopRun(box.target, run.run_id).catch(() => undefined);
      await closeRow();
      throw new PublishError("could not open the Create run; try again", 503);
    }
    return { run_id: run.run_id, session, slug: app.slug, appname, tier };
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
