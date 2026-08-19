/**
 * MA9.2 — Onairos connect step: the control plane receives the SDK handoff,
 * fetches the persona server-side, and writes the context into the user's
 * own box (~/.hermes/context/). Shared Postgres stores connections-style
 * metadata only (provider onairos, status) — the persona payload is content
 * and never touches a Postgres row or a log line (C4). The grant (apiUrl +
 * short-lived token) is stored box-side only, powering Re-sync, in the same
 * custody model as the vault key.
 *
 * This module is Session D's server-side interface for the onboarding
 * connect step: `syncOnairos` (connect + re-import), `resyncOnairos`,
 * `disconnectOnairos`, `onairosStatus`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, readFile, writeFile } from "@/lib/box/client";
import { shellQuote } from "@/lib/box/shell";
import { env } from "@/lib/env";
import {
  armStopAfter,
  ensureBoxAwake,
} from "@/lib/orchestrator/boxes";
import {
  addPointerLine,
  contextMarkdown,
  ONAIROS_GRANT_PATH,
  ONAIROS_JSON_PATH,
  ONAIROS_MD_PATH,
  OnairosError,
  removePointerLine,
  validateHandoff,
  type OnairosHandoff,
} from "./context";
import { USER_PROFILE_PATH } from "@/lib/memory/files";

const PROVIDER = "onairos";
const TOOLKIT = "persona";

export interface OnairosState {
  /** True when ONAIROS_API_KEY is set (the SDK button can be offered). */
  configured: boolean;
  status: "disconnected" | "pending" | "active" | "revoked" | "error";
  connectedAt: string | null;
}

/** POST to the returned apiUrl with the short-lived bearer token (the
 * documented Persona contract). The response body is content — callers must
 * never log it. */
export async function fetchPersona(handoff: OnairosHandoff): Promise<unknown> {
  const response = await fetch(handoff.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${handoff.token}`,
      "Content-Type": "application/json",
    },
    // Traits/profile request: no Input (inference-only field), no llmData.
    body: JSON.stringify({}),
  });
  if (response.status === 202) {
    throw new OnairosError(
      "persona still training — try re-sync in a minute",
      503
    );
  }
  if (!response.ok) {
    // Status code only: the body could carry grant or persona details.
    throw new OnairosError(`persona fetch failed (${response.status})`, 502);
  }
  return (await response.json()) as unknown;
}

async function writeContext(
  boxId: string,
  persona: unknown,
  handoff: OnairosHandoff
): Promise<void> {
  const syncedAt = new Date().toISOString();
  const mkdir = await command(boxId, "mkdir -p .hermes/context");
  if (mkdir.exitCode !== 0) throw new OnairosError("box write failed", 502);
  await writeFile(boxId, ONAIROS_MD_PATH, contextMarkdown(persona, syncedAt));
  await writeFile(
    boxId,
    ONAIROS_JSON_PATH,
    JSON.stringify({ synced_at: syncedAt, persona }, null, 2)
  );
  await writeFile(
    boxId,
    ONAIROS_GRANT_PATH,
    JSON.stringify({ apiUrl: handoff.apiUrl, token: handoff.token })
  );
  await command(boxId, `chmod 600 ${shellQuote(ONAIROS_GRANT_PATH)}`);
  // USER.md gets exactly one pointer line at the imported context (MA9.2).
  const user = await readFile(boxId, USER_PROFILE_PATH).catch(() => "");
  const updated = addPointerLine(user);
  if (updated !== user) {
    await command(boxId, "mkdir -p .hermes/memories");
    await writeFile(boxId, USER_PROFILE_PATH, updated);
  }
}

async function setStatus(
  supabase: SupabaseClient,
  userId: string,
  status: "active" | "revoked" | "error"
): Promise<void> {
  await supabase.from("connections").upsert(
    {
      user_id: userId,
      provider: PROVIDER,
      toolkit: TOOLKIT,
      status,
      connected_at: status === "active" ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,provider,toolkit" }
  );
}

/** Connect (or re-import with a fresh grant): validate the SDK handoff,
 * fetch the persona, write the box-side context files, flip metadata. */
export async function syncOnairos(
  supabase: SupabaseClient,
  userId: string,
  handoffInput: unknown
): Promise<{ syncedAt: string }> {
  const handoff = validateHandoff(handoffInput);
  const persona = await fetchPersona(handoff);
  const box = await ensureBoxAwake(supabase, userId);
  try {
    await writeContext(box.boxId, persona, handoff);
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
  await setStatus(supabase, userId, "active");
  return { syncedAt: new Date().toISOString() };
}

/** Re-sync from the box-stored grant. 409s when the grant is gone or its
 * short-lived token expired — the UI then offers a fresh connect. */
export async function resyncOnairos(
  supabase: SupabaseClient,
  userId: string
): Promise<{ syncedAt: string }> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    const raw = await readFile(box.boxId, ONAIROS_GRANT_PATH).catch(() => null);
    if (raw === null) {
      throw new OnairosError("no stored grant — reconnect Onairos", 409);
    }
    let handoff: OnairosHandoff;
    try {
      handoff = validateHandoff(JSON.parse(raw));
    } catch {
      throw new OnairosError("stored grant unreadable — reconnect Onairos", 409);
    }
    let persona: unknown;
    try {
      persona = await fetchPersona(handoff);
    } catch (error) {
      if (error instanceof OnairosError && error.status === 502) {
        throw new OnairosError("grant expired — reconnect Onairos", 409);
      }
      throw error;
    }
    await writeContext(box.boxId, persona, handoff);
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
  await setStatus(supabase, userId, "active");
  return { syncedAt: new Date().toISOString() };
}

/** Disconnect: delete every Onairos-derived byte box-side (context files,
 * stored grant, the USER.md pointer line) and mark the connection revoked.
 * Platform-side there is nothing else to delete — by construction only
 * provider/status metadata ever existed in Postgres. */
export async function disconnectOnairos(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    const rm = await command(
      box.boxId,
      `rm -f ${[ONAIROS_MD_PATH, ONAIROS_JSON_PATH, ONAIROS_GRANT_PATH]
        .map(shellQuote)
        .join(" ")}`
    );
    if (rm.exitCode !== 0) throw new OnairosError("box delete failed", 502);
    const user = await readFile(box.boxId, USER_PROFILE_PATH).catch(() => null);
    if (user !== null) {
      const updated = removePointerLine(user);
      if (updated !== user) {
        await writeFile(box.boxId, USER_PROFILE_PATH, updated);
      }
    }
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
  await setStatus(supabase, userId, "revoked");
}

export async function onairosStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<OnairosState> {
  const { data } = await supabase
    .from("connections")
    .select("status, connected_at")
    .eq("user_id", userId)
    .eq("provider", PROVIDER)
    .eq("toolkit", TOOLKIT)
    .maybeSingle();
  const status = (data?.status ?? "disconnected") as OnairosState["status"];
  return {
    configured: env.onairosApiKey() !== null,
    status,
    connectedAt: (data?.connected_at as string | null) ?? null,
  };
}
