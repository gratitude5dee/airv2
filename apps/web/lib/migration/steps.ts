/**
 * Per-phase step implementations for the migration driver. Every step is
 * idempotent: external work is journaled into compute_migrations.steps under
 * the worker claim, so a crashed driver replays cheaply and never repeats an
 * external call. "Persist intent before each external operation and
 * completion afterward" is enforced by stepReceipt/stepStart.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { stopCompute, destroyCompute, runCommand } from "../compute/runtime";
import { profileFor, kindFor } from "../compute/environments";
import { buildCompute } from "../provisioning/provision";
import { installComposioMcp, installMasterkeyMcp } from "../provisioning/connectors";
import { installExistingMailbox } from "../provisioning/email";
import { provisionDaytona } from "../provisioning/daytona";
import { providerOf, resume } from "../box/client";
import { env } from "../env";
import { sealSecret } from "../crypto/secretbox";
import {
  installFence,
  liftFence,
  probeFence,
  type FenceProof,
} from "./fence";
import {
  buildManifest,
  type ScannedEntry,
} from "./inventory";
import {
  applyPass,
  exportPass,
  importPass,
  installTransferTool,
  newServeToken,
  newTransferKey,
  runInventory,
  serveBundle,
  stopServe,
  verifyPass,
  writeManifest,
} from "./transfer";
import { replayHeldReceipts } from "./replay";
import {
  activeTarget,
  copySides,
  recordStep,
  retainedTarget,
  transition,
  upsertTarget,
} from "./store";
import {
  openCredentials,
  routePayload,
  sealCredentials,
  type TargetCredentials,
} from "./credentials";
import {
  MigrationPreflightError,
  MigrationStateError,
  type ComputeMigration,
  type MigrationPhase,
  type MigrationTarget,
  type StepReceipt,
  type TenantControl,
} from "./types";

export interface StepCtx {
  supabase: SupabaseClient;
  migration: ComputeMigration;
  worker: string;
  control: TenantControl;
  targets: MigrationTarget[];
}

export type StepOutcome =
  | { kind: "advance"; phase: MigrationPhase; patch?: Record<string, unknown> }
  | { kind: "wait"; wakeAt: Date }
  | { kind: "stay"; wakeInMs: number }
  | { kind: "park" };

export function stepDone(_name: string, extra: Record<string, unknown> = {}): StepReceipt {
  return { finished_at: new Date().toISOString(), ...extra };
}

export function hasStep(migration: ComputeMigration, name: string): StepReceipt | null {
  return migration.steps?.[name] ?? null;
}

function stepName(ctx: StepCtx, name: string): string {
  return ctx.migration.leg === "back" ? `back:${name}` : name;
}

/** The generation this leg's commit expects to still be current. */
export function expectedGeneration(migration: ComputeMigration): number {
  return migration.leg === "out"
    ? migration.expected_generation
    : migration.expected_generation + 1;
}

async function loadBoxRow(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("boxes")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

// ─── preflight ──────────────────────────────────────────────────────────────

export async function stepPreflight(ctx: StepCtx): Promise<StepOutcome> {
  const { supabase, migration } = ctx;
  if (!env.migrationEnabled()) {
    throw new MigrationPreflightError("disabled", "MIGRATION_ENABLED is not set");
  }
  if (!env.migrationSealKey()) {
    throw new MigrationPreflightError(
      "no_seal_key",
      "MIGRATION_SEAL_KEY (or BOX_DASHBOARD_AUTH_KEY) is required"
    );
  }
  const box = await loadBoxRow(supabase, migration.user_id);
  if (!box) {
    throw new MigrationPreflightError("no_box", "user has no box");
  }
  const environment = (box["environment"] as string) ?? "ubuntu";
  if (kindFor(environment as never) !== "box") {
    throw new MigrationPreflightError(
      "unsupported_environment",
      `migrations support kind=box environments only (got ${environment})`
    );
  }
  // C18: a vault-bearing account cannot move — AIR_VAULT_KEY never leaves
  // its box, so the account needs an explicit owner reconnection path before
  // it is eligible.
  const { count: vaultCount, error: vaultError } = await supabase
    .from("vault_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", migration.user_id);
  if (!vaultError && (vaultCount ?? 0) > 0) {
    throw new MigrationPreflightError(
      "vault_items_present",
      `${vaultCount} vault items — owner reconnection required before migration`
    );
  }
  // The target provider must have a template pointer — for Tenki that is the
  // pinned TENKI_TEMPLATE_ID snapshot ref (the approved release), for ascii
  // the channel/template fallback buildCompute already applies.
  if (migration.target_provider === "tenki") {
    const ref = env.tenkiTemplateId();
    if (!ref || providerOf(ref) !== "tenki") {
      throw new MigrationPreflightError(
        "no_target_template",
        "TENKI_TEMPLATE_ID must pin a tenki:<snapshot> release"
      );
    }
  }

  // Inventory + classification (plan §4).
  const source = { instanceId: migration.source_box_id, environment: environment as never };
  if (!hasStep(migration, stepName(ctx, "preflight.tool"))) {
    await installTransferTool(source);
    ctx.migration = await recordStep(
      supabase, migration, ctx.worker,
      stepName(ctx, "preflight.tool"), stepDone(stepName(ctx, "preflight.tool"))
    );
  }
  if (!hasStep(migration, stepName(ctx, "preflight.inventory"))) {
    const scanned = (await runInventory(source, migration.id)) as ScannedEntry[];
    const manifest = buildManifest(migration.source_box_id, scanned);
    const hardBlockers = manifest.blockers;
    ctx.migration = await recordStep(
      supabase, migration, ctx.worker,
      stepName(ctx, "preflight.inventory"),
      stepDone(stepName(ctx, "preflight.inventory"), {
        totals: manifest.totals,
      }),
      { manifest }
    );
    if (hardBlockers.length > 0) {
      throw new MigrationPreflightError(
        "manifest_blockers",
        hardBlockers.join("; ")
      );
    }
  }
  return { kind: "advance", phase: "preparing" };
}

// ─── preparing ──────────────────────────────────────────────────────────────

export async function stepPreparing(ctx: StepCtx): Promise<StepOutcome> {
  const { supabase, migration } = ctx;
  const box = await loadBoxRow(supabase, migration.user_id);
  if (!box) throw new MigrationStateError("route_moved", "box row vanished");
  const environment = (box["environment"] as string) ?? "ubuntu";
  const channel = (box["channel"] as string) ?? "prod";

  if (!hasStep(migration, stepName(ctx, "prepare.provision"))) {
    const built = await buildCompute(
      supabase,
      migration.user_id,
      environment as never,
      channel as never,
      migration.target_provider as never
    );
    // Candidate credentials: everything the commit needs to re-point the
    // boxes row, sealed — never persisted in plaintext on the migration.
    const dashKey = env.boxDashboardAuthKey();
    const creds: TargetCredentials = {
      provider:
        providerOf(built.target.instanceId) === "tenki"
          ? "tenki"
          : profileFor(environment as never).provider,
      provider_box_id: built.target.instanceId,
      environment,
      hosted_url: built.routes.hermes.url,
      hosted_token: built.routes.hermes.token,
      dashboard_url: built.routes.dashboard.url,
      dashboard_token: built.routes.dashboard.token,
      dashboard_auth: dashKey ? sealSecret(built.dashPassword, dashKey) : null,
      api_server_key: built.apiServerKey,
      gateway_token: built.gatewayToken,
      template_version: built.templateHermesRef,
      channel: built.channel,
      baseline_version: built.release?.version ?? null,
      baseline_synced_at: built.release ? new Date().toISOString() : null,
      provider_name: migration.target_provider,
      control_url: built.target.control?.url ?? null,
      control_token: built.target.control?.token ?? null,
      state: "ready",
    };
    await upsertTarget(supabase, {
      migration_id: migration.id,
      role: "candidate",
      provider: migration.target_provider,
      provider_box_id: built.target.instanceId,
      hosted_url: built.routes.hermes.url,
      credentials_sealed: sealCredentials(creds),
    });
    ctx.migration = await recordStep(
      supabase, migration, ctx.worker,
      stepName(ctx, "prepare.provision"),
      stepDone(stepName(ctx, "prepare.provision"), {
        candidate_box_id: built.target.instanceId,
      }),
      { candidate_box_id: built.target.instanceId }
    );
  }
  const candidateId = migration.candidate_box_id;
  if (!candidateId) {
    throw new MigrationStateError("no_candidate", "candidate missing after provision");
  }
  const candidate = { instanceId: candidateId, environment: environment as never };

  if (!hasStep(migration, stepName(ctx, "prepare.fence"))) {
    const proof: FenceProof = {
      migration_id: migration.id,
      role: "candidate",
      fence_epoch: ctx.control.fence_epoch,
      routing_generation: expectedGeneration(migration),
      installed_at: new Date().toISOString(),
    };
    await installFence(candidate, proof);
    ctx.migration = await recordStep(
      supabase, migration, ctx.worker,
      stepName(ctx, "prepare.fence"), stepDone(stepName(ctx, "prepare.fence"))
    );
  }
  if (!hasStep(migration, stepName(ctx, "prepare.tool"))) {
    await installTransferTool(candidate);
    ctx.migration = await recordStep(
      supabase, migration, ctx.worker,
      stepName(ctx, "prepare.tool"), stepDone(stepName(ctx, "prepare.tool"))
    );
  }
  // Seal the source's live credentials for the return leg: the commit will
  // overwrite the boxes row, so the envelope is the only copy left.
  if (!hasStep(migration, stepName(ctx, "prepare.source_seal"))) {
    const fresh = await loadBoxRow(supabase, migration.user_id);
    if (!fresh) throw new MigrationStateError("route_moved", "box row vanished");
    const sourceCreds: TargetCredentials = {
      provider: String(fresh["provider"] ?? migration.source_provider),
      provider_box_id: migration.source_box_id,
      environment,
      hosted_url: String(fresh["hosted_url"] ?? ""),
      hosted_token: String(fresh["hosted_token"] ?? ""),
      dashboard_url: String(fresh["dashboard_url"] ?? ""),
      dashboard_token: String(fresh["dashboard_token"] ?? ""),
      dashboard_auth: (fresh["dashboard_auth"] as string | null) ?? null,
      api_server_key: String(fresh["api_server_key"] ?? ""),
      gateway_token: String(fresh["gateway_token"] ?? ""),
      template_version: (fresh["template_version"] as string | null) ?? null,
      channel: (fresh["channel"] as string | null) ?? null,
      baseline_version: (fresh["baseline_version"] as string | null) ?? null,
      baseline_synced_at: (fresh["baseline_synced_at"] as string | null) ?? null,
      provider_name: (fresh["provider_name"] as string | null) ?? migration.source_provider,
      control_url: (fresh["control_url"] as string | null) ?? null,
      control_token: (fresh["control_token"] as string | null) ?? null,
      state: "ready",
    };
    await upsertTarget(supabase, {
      migration_id: migration.id,
      role: "source",
      credentials_sealed: sealCredentials(sourceCreds),
    });
    ctx.migration = await recordStep(
      supabase, migration, ctx.worker,
      stepName(ctx, "prepare.source_seal"),
      stepDone(stepName(ctx, "prepare.source_seal"))
    );
  }
  return { kind: "advance", phase: "precopy" };
}

// ─── precopy / final_copy ───────────────────────────────────────────────────

interface PassOutcome {
  bundleBytes: number;
  files: number;
  verified: boolean;
}

/**
 * One copy pass: re-inventory the source, classify, push a delta bundle to
 * the target, apply, verify. The manifest is always the FULL classified set
 * (apply derives deletions from it); the export is restricted to entries
 * whose hash changed since the last pass, except sqlite state which always
 * re-crosses as a whole-database backup (plan §4).
 */
export async function runPass(
  ctx: StepCtx,
  passName: string,
  from: MigrationTarget,
  to: MigrationTarget,
  environment: string
): Promise<PassOutcome> {
  const { supabase, migration, worker } = ctx;
  const fromTarget = { instanceId: from.provider_box_id, environment: environment as never };
  const toTarget = { instanceId: to.provider_box_id, environment: environment as never };

  const scanned = (await runInventory(fromTarget, migration.id)) as ScannedEntry[];
  const classified = buildManifest(migration.source_box_id, scanned);
  const prev = (migration.stats?.["last_manifest"] ?? null) as {
    entries?: { path: string; sha256: string; kind: string }[];
  } | null;
  const prevHashes = new Map(
    (prev?.entries ?? []).map((e) => [e.path, `${e.sha256}:${e.kind}`])
  );
  const delta = classified.entries.filter((entry) => {
    if (entry.classification !== "transfer" && entry.classification !== "reconnect") {
      return false;
    }
    if (entry.kind === "sqlite") return true; // always whole-db
    return prevHashes.get(entry.path) !== `${entry.sha256}:${entry.kind}`;
  });

  const fullManifestPath = await writeManifest(
    toTarget, migration.id, classified, `${passName}-full`
  );
  const exportManifestPath = await writeManifest(
    fromTarget, migration.id,
    { ...classified, entries: delta },
    `${passName}-delta`
  );

  const transferKey = newTransferKey();
  const serveToken = newServeToken();
  const receipt = await exportPass(
    fromTarget, migration.id, passName, exportManifestPath, transferKey
  );
  let pid: number | null = null;
  try {
    const served = await serveBundle(fromTarget, migration.id, passName, serveToken);
    pid = served.pid;
    await importPass(
      toTarget, migration.id, passName, served.url, serveToken, transferKey
    );
  } finally {
    if (pid !== null) await stopServe(fromTarget, pid);
  }
  const applied = await applyPass(
    toTarget, migration.id, passName, fullManifestPath
  );
  const verify = await verifyPass(toTarget, migration.id, fullManifestPath);

  ctx.migration = await recordStep(
    supabase, migration, worker,
    stepName(ctx, `${passName}.done`),
    stepDone(stepName(ctx, `${passName}.done`), {
      bundle_bytes: receipt.bytes,
      exported_files: receipt.files,
      applied: applied.applied,
      deleted: applied.deleted,
      verified: verify.ok,
      mismatches: verify.mismatches.slice(0, 20),
    }),
    {
      stats: {
        ...(migration.stats ?? {}),
        last_manifest: {
          entries: classified.entries.map((e) => ({
            path: e.path, sha256: e.sha256, kind: e.kind,
          })),
        },
        [`${passName}_bytes`]: receipt.bytes,
      },
    }
  );
  if (!verify.ok) {
    throw new MigrationStateError(
      "integrity",
      `verify failed: ${verify.mismatches.length} mismatches`
    );
  }
  return { bundleBytes: receipt.bytes, files: receipt.files, verified: verify.ok };
}

export async function stepPrecopy(ctx: StepCtx): Promise<StepOutcome> {
  const { migration } = ctx;
  const { from, to } = copySides(migration, ctx.targets);
  const box = await loadBoxRow(ctx.supabase, migration.user_id);
  const environment = (box?.["environment"] as string) ?? "ubuntu";
  const maxPasses = env.migrationPrecopyPasses();
  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const name = stepName(ctx, `precopy.pass.${pass}`);
    if (hasStep(migration, name)) continue;
    await runPass(ctx, `precopy-pass-${pass}`, from, to, environment);
  }
  return { kind: "advance", phase: "waiting_for_idle" };
}

// ─── waiting_for_idle ───────────────────────────────────────────────────────

const MAX_DRAIN_DEFERRALS = 3;

export async function stepWaitingForIdle(ctx: StepCtx): Promise<StepOutcome> {
  const { supabase, migration, worker } = ctx;

  // Close admission once — idempotent across replays.
  if (ctx.control.admission !== "closed") {
    const { data, error } = await supabase.rpc("close_admission", {
      p_migration_id: migration.id,
      p_expected_generation: expectedGeneration(migration),
    });
    const result = data as { ok?: boolean; reason?: string } | null;
    if (error || !result?.ok) {
      throw new MigrationStateError(
        result?.reason ?? "close_failed",
        `close_admission refused: ${result?.reason ?? error?.message}`
      );
    }
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "wait.close"),
      stepDone(stepName(ctx, "wait.close")),
      { work_paused_at: new Date().toISOString() }
    );
  }

  const { data: live } = await supabase
    .from("tenant_operations")
    .select("id")
    .eq("user_id", migration.user_id)
    .is("finished_at", null)
    .gt("expires_at", new Date().toISOString());
  const liveCount = live?.length ?? 0;
  if (liveCount === 0) {
    return { kind: "advance", phase: "quiescing" };
  }

  const pausedAt = migration.work_paused_at
    ? Date.parse(migration.work_paused_at)
    : Date.now();
  const elapsed = Date.now() - pausedAt;
  if (elapsed > env.migrationDrainBudgetMs()) {
    const deferrals = Number(migration.stats?.["drain_deferrals"] ?? 0) + 1;
    if (deferrals > MAX_DRAIN_DEFERRALS) {
      throw new MigrationStateError(
        "drain_timeout",
        `${liveCount} operations still running after ${MAX_DRAIN_DEFERRALS} deferrals`
      );
    }
    // Reopen so user traffic isn't held while we wait for a quieter window;
    // the next drive re-closes.
    await supabase.rpc("open_admission", { p_migration_id: migration.id });
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, `wait.defer.${deferrals}`),
      stepDone(stepName(ctx, `wait.defer.${deferrals}`), { live_operations: liveCount }),
      {
        work_paused_at: null,
        stats: { ...(migration.stats ?? {}), drain_deferrals: deferrals },
      }
    );
    return { kind: "stay", wakeInMs: 30_000 };
  }
  return { kind: "stay", wakeInMs: 5_000 };
}

// ─── quiescing ──────────────────────────────────────────────────────────────

export async function stepQuiescing(ctx: StepCtx): Promise<StepOutcome> {
  const { supabase, migration, worker } = ctx;
  const { from } = copySides(migration, ctx.targets);
  const box = await loadBoxRow(supabase, migration.user_id);
  const environment = (box?.["environment"] as string) ?? "ubuntu";
  const fromTarget = { instanceId: from.provider_box_id, environment: environment as never };

  if (!hasStep(migration, stepName(ctx, "quiesce.fence"))) {
    const ctl = await supabase
      .from("tenant_control")
      .select("fence_epoch, routing_generation")
      .eq("user_id", migration.user_id)
      .single();
    const epoch = (ctl.data?.fence_epoch as number) ?? 0;
    const gen = (ctl.data?.routing_generation as number) ?? expectedGeneration(migration);
    const proof: FenceProof = {
      migration_id: migration.id,
      role: "retained",
      fence_epoch: epoch,
      routing_generation: gen,
      installed_at: new Date().toISOString(),
    };
    await installFence(fromTarget, proof);
    const probe = await probeFence(fromTarget, {
      migration_id: migration.id,
      fence_epoch: epoch,
    });
    if (!probe.holding) {
      throw new MigrationStateError(
        "fence_not_holding",
        `fence probe failed: ${JSON.stringify(probe.detail)}`
      );
    }
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "quiesce.fence"),
      stepDone(stepName(ctx, "quiesce.fence"), probe.detail)
    );
  }

  // Freeze claimed-but-unfinished schedule occurrences for replay.
  if (!hasStep(migration, stepName(ctx, "quiesce.hold"))) {
    await supabase
      .from("delivery_receipts")
      .update({ state: "held", updated_at: new Date().toISOString() })
      .eq("user_id", migration.user_id)
      .eq("kind", "schedule_occurrence")
      .eq("state", "running");
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "quiesce.hold"), stepDone(stepName(ctx, "quiesce.hold"))
    );
  }
  return { kind: "advance", phase: "final_copy" };
}

// ─── final_copy ─────────────────────────────────────────────────────────────

export async function stepFinalCopy(ctx: StepCtx): Promise<StepOutcome> {
  const { migration } = ctx;
  const { from, to } = copySides(migration, ctx.targets);
  const box = await loadBoxRow(ctx.supabase, migration.user_id);
  const environment = (box?.["environment"] as string) ?? "ubuntu";
  const name = stepName(ctx, "final.pass");
  if (!hasStep(migration, name)) {
    await runPass(ctx, `${migration.leg}-final`, from, to, environment);
  }

  // The route commit — the single transaction. A refused commit here is not
  // fatal to the account: admission reopens and the source stays live.
  const toSealed = to.credentials_sealed;
  if (!toSealed) {
    throw new MigrationStateError("no_credentials", "target envelope missing");
  }
  const creds = openCredentials(toSealed);
  const { data, error } = await ctx.supabase.rpc("commit_migration_route", {
    p_migration_id: migration.id,
    p_from_box_id: from.provider_box_id,
    p_expected_generation: expectedGeneration(migration),
    p_route: routePayload(creds),
  });
  const result = data as { ok?: boolean; reason?: string; routing_generation?: number } | null;
  if (error || !result?.ok) {
    throw new MigrationStateError(
      result?.reason ?? "commit_failed",
      `route commit refused: ${result?.reason ?? error?.message}`
    );
  }
  // The RPC already moved the phase; reflect it locally so the driver's CAS
  // advance goes straight to activating.
  ctx.migration.phase = "route_committed";
  return { kind: "advance", phase: "activating" };
}

// ─── activating ─────────────────────────────────────────────────────────────

export async function stepActivating(ctx: StepCtx): Promise<StepOutcome> {
  const { supabase, migration, worker } = ctx;
  const to = activeTarget(ctx.targets);
  if (!to) throw new MigrationStateError("targets_missing", "no active target");
  const box = await loadBoxRow(supabase, migration.user_id);
  const environment = (box?.["environment"] as string) ?? "ubuntu";
  const toTarget = { instanceId: to.provider_box_id, environment: environment as never };

  if (!hasStep(migration, stepName(ctx, "activate.lift"))) {
    await liftFence(toTarget);
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "activate.lift"), stepDone(stepName(ctx, "activate.lift"))
    );
  }
  if (!hasStep(migration, stepName(ctx, "activate.health"))) {
    // Gateway health from inside the box: no external route dependency, the
    // same probe hermes-host expects up before it re-registers.
    const health = await runCommand(
      toTarget,
      "for i in $(seq 1 30); do curl -sf -o /dev/null http://127.0.0.1:8642/health && echo HEALTHY && break; sleep 2; done",
      90
    );
    if (!health.stdout.includes("HEALTHY")) {
      throw new MigrationStateError(
        "activation_health",
        "candidate gateway did not come up"
      );
    }
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "activate.health"), stepDone(stepName(ctx, "activate.health"))
    );
  }
  // Reconnect-class wiring: connectors and the mailbox are re-staged so a
  // stale or missing registration is replaced (the mailbox draft key is a
  // second, target-scoped key — the source's key is untouched (C10)).
  if (!hasStep(migration, stepName(ctx, "activate.wiring"))) {
    const logError = (what: string) => (error: unknown) =>
      console.error(
        JSON.stringify({
          msg: "activation wiring failed",
          what,
          migration_id: migration.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    await installComposioMcp(supabase, migration.user_id, toTarget).catch(
      logError("composio")
    );
    await installMasterkeyMcp(supabase, migration.user_id, toTarget).catch(
      logError("masterkey")
    );
    if (kindFor(environment as never) === "box") {
      await installExistingMailbox(
        supabase,
        migration.user_id,
        to.provider_box_id
      ).catch(logError("mailbox"));
      await provisionDaytona(toTarget, migration.user_id).catch(
        logError("daytona")
      );
    }
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "activate.wiring"), stepDone(stepName(ctx, "activate.wiring"))
    );
  }

  // Resume: held deliveries replay under their original identity —
  // schedule occurrences get their due time back so the next sweep
  // re-claims them (receipt dedupe turns replays into no-ops), held email
  // re-runs against its durable provider-message reference.
  if (!hasStep(migration, stepName(ctx, "activate.resume"))) {
    const replayed = await replayHeldReceipts(supabase, migration.user_id);
    const { error } = await supabase.rpc("open_admission", {
      p_migration_id: migration.id,
    });
    if (error) {
      throw new MigrationStateError(
        "reopen_failed",
        `open_admission failed: ${error.message}`
      );
    }
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "activate.resume"),
      stepDone(stepName(ctx, "activate.resume"), {
        replayed: replayed.replayed,
        replay_failed: replayed.failed,
      }),
      { work_resumed_at: new Date().toISOString(), activated_at: new Date().toISOString() }
    );
  }
  return {
    kind: "advance",
    phase: "observing",
    patch: { wake_at: new Date(Date.now() + env.migrationObserveMs()).toISOString() },
  };
}

// ─── observing ──────────────────────────────────────────────────────────────

export async function stepObserving(ctx: StepCtx): Promise<StepOutcome> {
  const { supabase, migration, worker } = ctx;
  const box = await loadBoxRow(supabase, migration.user_id);
  const environment = (box?.["environment"] as string) ?? "ubuntu";
  const from = retainedTarget(ctx.targets);
  if (!from) throw new MigrationStateError("targets_missing", "no retained target");
  const fromTarget = { instanceId: from.provider_box_id, environment: environment as never };

  if (!hasStep(migration, stepName(ctx, "observe.fence_probe"))) {
    const ctl = await supabase
      .from("tenant_control")
      .select("fence_epoch")
      .eq("user_id", migration.user_id)
      .single();
    const probe = await probeFence(fromTarget, {
      migration_id: migration.id,
      fence_epoch: (ctl.data?.fence_epoch as number) ?? 0,
    });
    if (!probe.holding) {
      throw new MigrationStateError(
        "retained_fence_lost",
        `retained source drifted: ${JSON.stringify(probe.detail)}`
      );
    }
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "observe.fence_probe"),
      stepDone(stepName(ctx, "observe.fence_probe"), probe.detail)
    );
  }
  // Warm window elapsed — stop the retained source (its fence stays: masked
  // units cannot come back on resume).
  if (!hasStep(migration, stepName(ctx, "observe.stop_source"))) {
    try {
      await stopCompute(fromTarget);
    } catch (error) {
      // A refused stop keeps the source warm and fenced — safe; retry next drive.
      console.error(
        JSON.stringify({
          msg: "retained source stop refused",
          migration_id: migration.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return { kind: "stay", wakeInMs: 60_000 };
    }
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "observe.stop_source"),
      stepDone(stepName(ctx, "observe.stop_source")),
      { retention_until: new Date(Date.now() + env.migrationRetainMs()).toISOString() }
    );
  }
  return { kind: "advance", phase: "cleanup_pending" };
}

// ─── cleanup_pending ────────────────────────────────────────────────────────

export async function stepCleanupPending(ctx: StepCtx): Promise<StepOutcome> {
  const { migration } = ctx;
  if (!migration.cleanup_approved_at) {
    // Operator acceptance is required for source deletion (plan §7).
    return { kind: "stay", wakeInMs: 6 * 60 * 60 * 1000 };
  }
  const until = migration.retention_until
    ? Date.parse(migration.retention_until)
    : 0;
  if (Date.now() < until) {
    return { kind: "stay", wakeInMs: Math.min(until - Date.now(), 60 * 60 * 1000) };
  }
  return { kind: "advance", phase: "cleanup_pending" }; // driver runs cleanup step
}

export async function runSourceDelete(ctx: StepCtx): Promise<void> {
  const { supabase, migration, worker } = ctx;
  const { from } = copySides(migration, ctx.targets);
  const box = await loadBoxRow(supabase, migration.user_id);
  const environment = (box?.["environment"] as string) ?? "ubuntu";
  const fromTarget = { instanceId: from.provider_box_id, environment: environment as never };
  if (!hasStep(migration, stepName(ctx, "cleanup.delete_source"))) {
    await destroyCompute(fromTarget);
    ctx.migration = await recordStep(
      supabase, migration, worker,
      stepName(ctx, "cleanup.delete_source"),
      stepDone(stepName(ctx, "cleanup.delete_source"))
    );
  }
}

// ─── cancel / return compensation ───────────────────────────────────────────

/**
 * Pre-commit compensation: lift the source fence if it went on, reopen
 * admission, and destroy the candidate. Order is dependency-correct: the
 * candidate dies only after the source can serve again.
 */
export async function runCancelCompensation(ctx: StepCtx): Promise<void> {
  const { supabase, migration, worker } = ctx;
  const box = await loadBoxRow(supabase, migration.user_id);
  const environment = (box?.["environment"] as string) ?? "ubuntu";

  const sourceId = migration.source_box_id;
  const source = { instanceId: sourceId, environment: environment as never };
  if (hasStep(migration, stepName(ctx, "quiesce.fence")) && migration.leg === "out") {
    await liftFence(source).catch((error) => {
      console.error(
        JSON.stringify({
          msg: "cancel: source fence lift failed",
          migration_id: migration.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    });
  }
  if (ctx.control.admission === "closed") {
    try {
      await supabase.rpc("open_admission", { p_migration_id: migration.id });
    } catch {
      /* lease expiry covers a lost release */
    }
  }
  if (migration.candidate_box_id) {
    const candidate = {
      instanceId: migration.candidate_box_id,
      environment: environment as never,
    };
    await destroyCompute(candidate).catch((error) => {
      console.error(
        JSON.stringify({
          msg: "cancel: candidate destroy failed",
          migration_id: migration.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    });
  }
  void worker;
}

/**
 * Kick off the return leg: resume the retained side if stopped, re-close
 * admission under the post-commit generation, then replay the pause
 * sequence with legs swapped. The fence survives resume — masked units
 * cannot come back — so waking the retained box is safe.
 */
export async function beginReturnLeg(ctx: StepCtx): Promise<ComputeMigration> {
  const { supabase, migration, worker } = ctx;
  const retained = retainedTarget(ctx.targets);
  if (!retained) {
    throw new MigrationStateError("targets_missing", "no retained target for return");
  }
  if (!hasStep(migration, "return.wake_retained")) {
    await resume(retained.provider_box_id).catch((error) => {
      throw new MigrationStateError(
        "retained_resume_failed",
        `retained box would not resume: ${error instanceof Error ? error.message : error}`
      );
    });
    ctx.migration = await recordStep(
      supabase, migration, worker,
      "return.wake_retained",
      stepDone("return.wake_retained")
    );
  }
  const ctl = await supabase
    .from("tenant_control")
    .select("admission")
    .eq("user_id", migration.user_id)
    .single();
  if ((ctl.data?.admission as string) !== "closed") {
    // The out leg's commit bumped the generation; the close is verified
    // against expected_generation + 1, which is what now lives on the row.
    const { data, error } = await supabase.rpc("close_admission", {
      p_migration_id: migration.id,
      p_expected_generation: migration.expected_generation + 1,
    });
    const result = data as { ok?: boolean; reason?: string } | null;
    if (error || !result?.ok) {
      throw new MigrationStateError(
        result?.reason ?? "close_failed",
        "return leg could not close admission"
      );
    }
  }
  return transition(supabase, migration, worker, ["return_requested"], {
    phase: "waiting_for_idle",
    leg: "back",
    work_paused_at: new Date().toISOString(),
  });
}

