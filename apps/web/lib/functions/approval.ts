/**
 * Owner-side resolution of the `miniapp_backend` decision (goal-create-v11
 * §4.1, CR4). Two entry points reach it — the Needs-you card
 * (/api/decisions) and the Functions tab (/api/create/functions/approve) —
 * and both run under the owner's session; the agent's routes only stage.
 * Approving stamps the approved manifest, guarantees an active runtime
 * token, redeploys the live Worker so the module actually runs, and
 * re-signs the KV manifest the Dispatcher and Outbound read.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownedApp } from "../miniapps/publish";
import { recordOpsEvent } from "../security/limits";
import {
  approveBackend,
  BACKEND_DECISION_KIND,
  BackendError,
  fileBackendDecision,
  loadFunctions,
  pendingProposal,
  setKillSwitch,
  stageDeclaration,
  type FunctionsRow,
} from "./backend";
import {
  appOriginLaneReady,
  deployStaticVersion,
  loadRelease,
  promoteVersion,
  syncManifest,
} from "./deploy";
import type { FunctionsDeclaration } from "./egress";
import { ensureResources } from "./provision";
import { ensureRuntimeToken, rotateRuntimeToken, runtimeTokensReady } from "./runtime";
import type { RegistryApp } from "../miniapps/registry";

export type BackendResolution = "approved" | "dismissed";

/** Flip the one pending decision for the app; false when none was pending. */
export async function resolveBackendDecisionRow(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  status: BackendResolution
): Promise<boolean> {
  const { data } = await supabase
    .from("decisions")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("kind", BACKEND_DECISION_KIND)
    .eq("ref", slug)
    .eq("status", "pending")
    .select("id");
  return Array.isArray(data) && data.length > 0;
}

/**
 * Approve whatever the app currently declares. Owner session only. Returns
 * the stamped row, or null when there is nothing declared to approve.
 */
export async function approveBackendForOwner(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<FunctionsRow | null> {
  const app = await ownedApp(supabase, userId, slug);
  // Nothing is stamped when the runtime cannot mint a resolvable token: an
  // approved backend whose every call 401s is worse than a pending card.
  if (!runtimeTokensReady()) {
    throw new BackendError(503, "the Functions runtime is not configured (runtime KV)");
  }
  const approval = await approveBackend(supabase, app.id);
  if (!approval) return null;
  try {
    let row = approval.row;
    if (appOriginLaneReady()) {
      row = await ensureResources(supabase, row, slug, {
        db: approval.approved.db,
        kv: approval.approved.kv,
      });
    }
    await ensureRuntimeToken(supabase, row);
    // Reload: approveBackend flipped functions_enabled, which the manifest reads.
    const current = await ownedApp(supabase, userId, slug);
    if (current.status === "published" && current.bundle_version) {
      await promoteVersion(supabase, current, current.bundle_version);
    } else {
      await syncManifest(supabase, current);
    }
  } catch (error) {
    await supabase
      .from("miniapp_functions")
      .update({ last_error: error instanceof Error ? error.message.slice(0, 500) : "deploy failed" })
      .eq("app_id", app.id);
    throw error;
  }
  await supabase
    .from("miniapp_functions")
    .update({ deployed_at: new Date().toISOString(), last_error: null })
    .eq("app_id", app.id);
  await recordOpsEvent(supabase, "fn_backend", userId, `${slug}:approved`);
  return (await loadFunctions(supabase, app.id)) ?? approval.row;
}

/**
 * True when the approved manifest is what actually runs: nothing new is
 * declared and the last approval's deploy finished. Anything else — a
 * failed redeploy, an approval that never reached the Worker — means a
 * fresh owner tap should run the approval again rather than say "unchanged".
 */
export function approvalDeployed(row: FunctionsRow): boolean {
  return (
    pendingProposal(row) === null &&
    row.status === "live" &&
    row.last_error === null &&
    row.deployed_at !== null &&
    row.approved_at !== null &&
    row.deployed_at >= row.approved_at
  );
}

/**
 * Stage a declaration from the tab or the CLI (owner or agent) and file the
 * decision it needs. Never approves: the returned `decision` id is what the
 * owner still has to tap.
 */
export async function stageBackend(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  declared: FunctionsDeclaration
): Promise<{ row: FunctionsRow; decision: string | null }> {
  const app = await ownedApp(supabase, userId, slug);
  let row = await stageDeclaration(supabase, app, declared);
  if (appOriginLaneReady()) {
    row = await ensureResources(supabase, row, slug, { db: declared.db, kv: declared.kv });
  }
  const decision = await fileBackendDecision(supabase, app, row);
  await syncManifest(supabase, await ownedApp(supabase, userId, slug)).catch((error) => {
    console.warn(
      JSON.stringify({
        msg: "manifest sync after backend stage failed",
        app: slug,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  });
  return { row, decision };
}

/**
 * Re-put both Workers from their stored releases so a changed backend row
 * (kill switch, re-enable) takes effect: `deployStaticVersion` decides per
 * target whether the module or the static stub is `main_module`.
 */
async function redeployTargets(supabase: SupabaseClient, app: RegistryApp): Promise<void> {
  if (!appOriginLaneReady() || !app.owner_user_id) return;
  if (app.status === "published" && app.bundle_version) {
    await promoteVersion(supabase, app, app.bundle_version);
  }
  const draft = app.draft_version;
  if (draft) {
    const { files, module } = await loadRelease(app.slug, draft);
    if (files.length > 0) {
      await deployStaticVersion(supabase, {
        appId: app.id,
        slug: app.slug,
        version: draft,
        ownerUserId: app.owner_user_id,
        files,
        module,
        target: "draft",
      });
    }
  }
  await syncManifest(supabase, app);
}

/** §11.7 kill switch from the tab (owner) or /api/admin/ops (admin). */
export async function killBackend(
  supabase: SupabaseClient,
  app: RegistryApp,
  killed: boolean,
  by: "owner" | "admin"
): Promise<FunctionsRow | null> {
  const row = await setKillSwitch(supabase, app.id, killed, by);
  if (!row) return null;
  const current: RegistryApp = {
    ...app,
    functions_enabled: !killed && row.status === "live",
  };
  await redeployTargets(supabase, current);
  if (app.owner_user_id) {
    await recordOpsEvent(
      supabase,
      "fn_kill",
      app.owner_user_id,
      `${app.slug}:${killed ? "killed" : "restored"}:${by}`
    );
  }
  return row;
}

/** Rotate the app's runtime token and re-sign the manifest with the new ref. */
export async function rotateBackendToken(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<{ tokenRef: string }> {
  const app = await ownedApp(supabase, userId, slug);
  const row = await loadFunctions(supabase, app.id);
  if (!row) throw new BackendError(409, "this app has no backend");
  const { tokenId } = await rotateRuntimeToken(supabase, app.id, userId);
  await syncManifest(supabase, app);
  await recordOpsEvent(supabase, "fn_rotate", userId, slug);
  return { tokenRef: tokenId };
}

export function isBackendError(error: unknown): error is BackendError {
  return error instanceof BackendError;
}
