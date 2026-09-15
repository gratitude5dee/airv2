/**
 * Kernel cloud browser sessions (Phase 1). The control plane owns every
 * session: boxes receive a bearer-scoped creation result once (cdp_ws_url
 * over TLS, then only the session id), the owner watches through the watch
 * mini-app, and Postgres holds sealed URLs — never plaintext (C27).
 *
 * Human control mirrors checkout handoffs: while a lease is active the box
 * CDP guard fails closed, so the agent cannot drive a browser the owner is
 * interacting with (C31).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  KernelError,
  kernelClient,
  kernelFailure,
  kernelProfileName,
  kernelProjectName,
  openKernelUrl,
  sealKernelUrl,
} from "./client";

export type KernelSessionStatus = "active" | "ended" | "failed";
export type KernelSessionPurpose = "errand" | "checkout" | "watch";

export interface KernelSession {
  id: string;
  user_id: string;
  kernel_session_id: string;
  project_id: string;
  purpose: KernelSessionPurpose;
  task_id: string | null;
  profile_name: string | null;
  vault_id: string | null;
  status: KernelSessionStatus;
  stealth: boolean;
  save_profile: boolean;
  human_control_expires_at: string | null;
  human_control_returned_at: string | null;
  recording_replay_id: string | null;
  replay_ids: string[];
  ended_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface KernelSessionRow extends KernelSession {
  cdp_url_sealed?: string | null;
  live_view_sealed?: string | null;
  replay_views_sealed?: Record<string, string> | null;
}

const COLUMNS =
  "id, user_id, kernel_session_id, project_id, purpose, task_id, profile_name, vault_id, status, stealth, save_profile, human_control_expires_at, human_control_returned_at, recording_replay_id, cdp_url_sealed, live_view_sealed, replay_views_sealed, ended_at, version, created_at, updated_at";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isKernelSessionId(value: string): boolean {
  return UUID_RE.test(value);
}

function hydrate(row: KernelSessionRow): KernelSession {
  const replayViews = row.replay_views_sealed ?? {};
  return {
    id: row.id,
    user_id: row.user_id,
    kernel_session_id: row.kernel_session_id,
    project_id: row.project_id,
    purpose: row.purpose,
    task_id: row.task_id,
    profile_name: row.profile_name,
    vault_id: row.vault_id,
    status: row.status,
    stealth: row.stealth,
    save_profile: row.save_profile,
    human_control_expires_at: row.human_control_expires_at,
    human_control_returned_at: row.human_control_returned_at,
    recording_replay_id: row.recording_replay_id,
    replay_ids: Object.keys(replayViews),
    ended_at: row.ended_at,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface KernelAccountRow {
  user_id: string;
  project_id: string;
  profile_name: string | null;
}

/**
 * Lazily provision the user's Kernel project. Concurrent first uses race on
 * the `kernel_accounts.user_id` primary key — the loser re-reads and wins
 * the same row (a create-then-select makes a duplicate project impossible to
 * persist).
 */
export async function ensureKernelAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<KernelAccountRow> {
  const { data: existing, error } = await supabase
    .from("kernel_accounts")
    .select("user_id, project_id, profile_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new KernelError(
      "kernel_store_error",
      "could not read the Kernel account",
      500
    );
  }
  if (existing) return existing as KernelAccountRow;

  const name = kernelProjectName(userId);
  let projectId: string;
  try {
    const created = await kernelClient().projects.create({ name });
    projectId = created.id;
  } catch (cause) {
    // A concurrently-created project with our deterministic name is fine —
    // adopt it rather than failing the whole session.
    try {
      const page = await kernelClient().projects.list({ name });
      const match = page.items.find(
        (p) => p.name === name && p.status === "active"
      );
      if (!match) throw new Error("no project");
      projectId = match.id;
    } catch {
      throw kernelFailure(cause);
    }
  }
  const { data, error: insertError } = await supabase
    .from("kernel_accounts")
    .insert({ user_id: userId, project_id: projectId })
    .select("user_id, project_id, profile_name")
    .maybeSingle();
  if (insertError || !data) {
    if (insertError?.code === "23505" || !data) {
      const { data: raced } = await supabase
        .from("kernel_accounts")
        .select("user_id, project_id, profile_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (raced) return raced as KernelAccountRow;
    }
    throw new KernelError(
      "kernel_store_error",
      "could not persist the Kernel account",
      500
    );
  }
  return data as KernelAccountRow;
}

/**
 * One Kernel profile per user makes signed-in errands survivable across
 * sessions. Single-writer: `save_profile` on a second live session is refused
 * here, before the SDK sees it.
 */
async function ensureKernelProfile(
  supabase: SupabaseClient,
  userId: string,
  account: KernelAccountRow
): Promise<string> {
  if (account.profile_name) return account.profile_name;
  const name = kernelProfileName(userId);
  try {
    await kernelClient(account.project_id).profiles.create({ name });
  } catch (cause) {
    // Already-exists is success for our deterministic name.
    const status =
      typeof cause === "object" && cause !== null && "status" in cause
        ? Number((cause as { status?: unknown }).status)
        : NaN;
    if (status !== 409) throw kernelFailure(cause);
  }
  const { error } = await supabase
    .from("kernel_accounts")
    .update({ profile_name: name, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("profile_name", null);
  if (error) {
    throw new KernelError(
      "kernel_store_error",
      "could not persist the Kernel profile",
      500
    );
  }
  return name;
}

export interface CreateKernelSessionInput {
  purpose?: KernelSessionPurpose;
  taskId?: string | null;
  startUrl?: string | null | undefined;
  stealth?: boolean | undefined;
  /** Persist the user's signed-in profile only after an owner-side opt-in. */
  saveProfile?: boolean | undefined;
  /** Attach a vault so the browser can mint payment cards. Requires a vault id. */
  vaultId?: string | null | undefined;
  timeoutSeconds?: number | undefined;
  /** True when this session was created for a checkout handoff. */
  kiosk?: boolean;
}

export interface KernelSessionCreateResult {
  session: KernelSession;
  /** Bearer credential — delivered to the caller once, stored sealed. */
  cdpUrl: string | null;
  liveViewUrl: string | null;
}

export async function createKernelSession(
  supabase: SupabaseClient,
  userId: string,
  input: CreateKernelSessionInput = {}
): Promise<KernelSessionCreateResult> {
  const account = await ensureKernelAccount(supabase, userId);
  const client = kernelClient(account.project_id);
  const purpose: KernelSessionPurpose = input.purpose ?? "errand";
  const saveProfile = input.saveProfile ?? false;
  const profileName = saveProfile
    ? await ensureKernelProfile(supabase, userId, account)
    : null;
  const vault = input.vaultId ?? null;

  // Single-writer rule for profiles: a second save_changes session on the
  // same profile would silently lose writes at Kernel — refuse up front.
  if (saveProfile && profileName) {
    const { data: live } = await supabase
      .from("kernel_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("save_profile", true);
    if (live && live.length > 0) {
      throw new KernelError(
        "profile_in_use",
        "another Kernel session is already writing this profile",
        409
      );
    }
  }

  const startUrl = (() => {
    const raw = input.startUrl;
    if (!raw) return undefined;
    try {
      const url = new URL(raw);
      return url.protocol === "https:" || url.protocol === "http:"
        ? url.toString()
        : undefined;
    } catch {
      return undefined;
    }
  })();

  let created;
  try {
    created = await client.browsers.create({
      stealth: input.stealth ?? true,
      ...(profileName
        ? { profile: { name: profileName, save_changes: saveProfile } }
        : {}),
      ...(vault ? { vaults: [{ name: vault }] } : {}),
      ...(startUrl ? { start_url: startUrl } : {}),
      headless: false,
      kiosk_mode: input.kiosk ?? false,
      // Kernel enforces inactivity; the hard cap remains 30 minutes.
      timeout_seconds: Math.min(Math.max(input.timeoutSeconds ?? 600, 60), 1800),
    });
  } catch (cause) {
    throw kernelFailure(cause);
  }

  const sessionId = created.session_id;
  const cdpUrl = created.cdp_ws_url ?? null;
  const liveViewUrl = created.browser_live_view_url ?? null;
  const { data, error } = await supabase
    .from("kernel_sessions")
    .insert({
      user_id: userId,
      kernel_session_id: sessionId,
      project_id: account.project_id,
      purpose,
      task_id: input.taskId ?? null,
      profile_name: profileName,
      vault_id: vault,
      status: "active",
      stealth: input.stealth ?? true,
      save_profile: saveProfile,
      cdp_url_sealed: cdpUrl ? sealKernelUrl(cdpUrl, "browser") : null,
      live_view_sealed: liveViewUrl
        ? sealKernelUrl(liveViewUrl, "browser")
        : null,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    // The cloud session already exists; never leave it running untracked.
    await client.browsers.deleteByID(sessionId).catch(() => undefined);
    throw new KernelError(
      "kernel_store_error",
      "could not persist the Kernel session",
      500
    );
  }
  return { session: hydrate(data as KernelSessionRow), cdpUrl, liveViewUrl };
}

export async function getKernelSession(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<KernelSession | null> {
  if (!isKernelSessionId(id)) return null;
  const { data, error } = await supabase
    .from("kernel_sessions")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new KernelError(
      "kernel_store_error",
      "could not read the Kernel session",
      500
    );
  }
  return data ? hydrate(data as KernelSessionRow) : null;
}

export async function listKernelSessions(
  supabase: SupabaseClient,
  userId: string,
  limit = 10
): Promise<KernelSession[]> {
  const { data, error } = await supabase
    .from("kernel_sessions")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new KernelError(
      "kernel_store_error",
      "could not list Kernel sessions",
      500
    );
  }
  return (data ?? []).map((row) => hydrate(row as KernelSessionRow));
}

/** Sealed credential access — only ever used for delivery, never for display. */
export async function kernelSessionSecret(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  kind: "cdp" | "live_view"
): Promise<string | null> {
  const { data, error } = await supabase
    .from("kernel_sessions")
    .select("cdp_url_sealed, live_view_sealed")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return openKernelUrl(
    kind === "cdp"
      ? (data.cdp_url_sealed as string | null)
      : (data.live_view_sealed as string | null),
    "browser"
  );
}

export async function endKernelSession(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<KernelSession | null> {
  const session = await getKernelSession(supabase, userId, id);
  if (!session) return null;
  if (session.status !== "active") return session;
  // Mark first so a dead Kernel-side session can never leave a stale active row.
  const { data, error } = await supabase
    .from("kernel_sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      version: session.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active")
    .select(COLUMNS)
    .maybeSingle();
  if (error) {
    throw new KernelError(
      "kernel_store_error",
      "could not end the Kernel session",
      500
    );
  }
  if (!data) return getKernelSession(supabase, userId, id);
  await kernelClient(session.project_id)
    .browsers.deleteByID(session.kernel_session_id)
    .catch(() => undefined);
  return hydrate(data as KernelSessionRow);
}

/** While a lease is live the box CDP guard fails closed (C31). */
export function kernelHumanControlActive(
  session: Pick<
    KernelSession,
    "human_control_expires_at" | "human_control_returned_at"
  >,
  nowMs: number = Date.now()
): boolean {
  if (session.human_control_returned_at) return false;
  const expiresAt = Date.parse(session.human_control_expires_at ?? "");
  return Number.isFinite(expiresAt) && expiresAt > nowMs;
}

export const KERNEL_HUMAN_CONTROL_MINUTES = 15;
const KERNEL_HUMAN_CONTROL_MAX = 30;

export async function beginKernelHumanControl(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  minutes: number = KERNEL_HUMAN_CONTROL_MINUTES
): Promise<KernelSession | null> {
  const session = await getKernelSession(supabase, userId, id);
  if (!session || session.status !== "active") return null;
  const bounded = Math.min(
    Math.max(1, Math.floor(minutes)),
    KERNEL_HUMAN_CONTROL_MAX
  );
  const until = new Date(Date.now() + bounded * 60_000).toISOString();
  const { data, error } = await supabase
    .from("kernel_sessions")
    .update({
      human_control_expires_at: until,
      human_control_returned_at: null,
      version: session.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("version", session.version)
    .select(COLUMNS)
    .maybeSingle();
  if (error || !data) {
    throw new KernelError(
      "kernel_store_error",
      "could not begin human control",
      500
    );
  }
  return hydrate(data as KernelSessionRow);
}

export async function returnKernelHumanControl(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<KernelSession | null> {
  const session = await getKernelSession(supabase, userId, id);
  if (!session) return null;
  const { data, error } = await supabase
    .from("kernel_sessions")
    .update({
      human_control_returned_at: new Date().toISOString(),
      version: session.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("version", session.version)
    .select(COLUMNS)
    .maybeSingle();
  if (error || !data) return null;
  return hydrate(data as KernelSessionRow);
}

export interface KernelReplayView {
  replay_id: string;
  /** Bearer credential — only delivered to the owner mini-app, never logged. */
  viewUrl: string | null;
}

/** Start recording; Kernel replays continue across the session lifetime. */
export async function startKernelReplay(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ replay_id: string | null }> {
  const session = await getKernelSession(supabase, userId, id);
  if (!session) throw new KernelError("kernel_not_found", "session not found", 404);
  try {
    const replay = await kernelClient(session.project_id).browsers.replays.start(
      session.kernel_session_id
    );
    const replayId = replay.replay_id ?? null;
    if (replayId) {
      await supabase
        .from("kernel_sessions")
        .update({
          recording_replay_id: replayId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId);
    }
    return { replay_id: replayId };
  } catch (cause) {
    throw kernelFailure(cause);
  }
}

/** Stop a replay and persist its sealed view URL for the watch mini-app. */
export async function stopKernelReplay(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  replayId?: string
): Promise<KernelReplayView | null> {
  const session = await getKernelSession(supabase, userId, id);
  if (!session) throw new KernelError("kernel_not_found", "session not found", 404);
  const target = replayId ?? session.recording_replay_id;
  if (!target) return null;
  let viewUrl: string | null = null;
  try {
    await kernelClient(session.project_id).browsers.replays.stop(
      target,
      { id_or_name: session.kernel_session_id }
    );
    const replays = await kernelClient(session.project_id).browsers.replays.list(
      session.kernel_session_id
    );
    viewUrl =
      replays.find((r) => r.replay_id === target)?.replay_view_url ?? null;
  } catch (cause) {
    throw kernelFailure(cause);
  }
  await supabase
    .from("kernel_sessions")
    .update({
      recording_replay_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (viewUrl) {
    const { data: row } = await supabase
      .from("kernel_sessions")
      .select("replay_views_sealed")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    const views =
      (row?.replay_views_sealed as Record<string, string> | null) ?? {};
    views[target] = sealKernelUrl(viewUrl, "browser");
    await supabase
      .from("kernel_sessions")
      .update({
        replay_views_sealed: views,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);
  }
  return { replay_id: target, viewUrl };
}

/** Owner-only replay view URLs, unsealed for iframe embed. */
export async function kernelReplayViewUrl(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  replayId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("kernel_sessions")
    .select("replay_views_sealed")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  const sealed = (data?.replay_views_sealed as Record<string, string> | null)?.[
    replayId
  ];
  return openKernelUrl(sealed ?? null, "browser");
}
