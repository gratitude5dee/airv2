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
  contextMarkdown,
  ONAIROS_GRANT_PATH,
  ONAIROS_JSON_PATH,
  ONAIROS_MD_PATH,
  OnairosError,
  personaBlock,
  removePersonaBlock,
  upsertPersonaBlock,
  validateHandoff,
  type OnairosHandoff,
} from "./context";
import {
  deepMemoryForget,
  deepMemoryIndex,
  OV_ONAIROS_URI,
} from "@/lib/memory/deep";
import { USER_PROFILE_PATH } from "@/lib/memory/files";

const PROVIDER = "onairos";
const TOOLKIT = "persona";

export interface OnairosState {
  /** True when ONAIROS_API_KEY is set (the SDK button can be offered). */
  configured: boolean;
  status: "disconnected" | "pending" | "active" | "revoked" | "error";
  connectedAt: string | null;
}

/** Inference endpoints URL resolution can hand back. They require an `Input`
 * body (host-provided inferenceData) and answer a bodyless POST with 400. */
const INFERENCE_ENDPOINTS =
  /\/(?:combined-inference|combinedInference|combined-training-inference|inferenceNoProof|mobileInferenceNoProof)$/i;

/** Traits-only endpoint the SDK itself falls back to when it has no `Input`
 * (src/onairosButton.jsx swaps the resolved URL for `<origin>/traits-only`). */
const TRAITS_ONLY_PATH = "/traits-only";

/** The URL to read traits from: the resolved apiUrl, unless it is an
 * inference endpoint — we never send `Input`, so those 400 and the
 * traits-only endpoint on the same origin is the SDK's own fallback. */
export function personaUrl(apiUrl: string): string {
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    return apiUrl;
  }
  if (!INFERENCE_ENDPOINTS.test(url.pathname)) return apiUrl;
  url.pathname = TRAITS_ONLY_PATH;
  return url.toString();
}

function personaRequest(
  handoff: OnairosHandoff,
  method: "POST" | "GET"
): Promise<Response> {
  return fetch(personaUrl(handoff.apiUrl), {
    method,
    headers: {
      Authorization: `Bearer ${handoff.token}`,
      "Content-Type": "application/json",
    },
    // Traits/profile request: no Input (inference-only field), no llmData.
    ...(method === "POST" ? { body: JSON.stringify({}) } : {}),
  });
}

/** Endpoint path of a handoff URL — safe to log (no token, no payload). */
function personaPath(apiUrl: string): string {
  try {
    return new URL(apiUrl).pathname;
  } catch {
    return "invalid";
  }
}

/** Fetch the persona from the returned apiUrl with the short-lived bearer
 * token. The documented contract is a POST, but URL resolution also hands
 * back read-only endpoints (`/persona/full`) that answer a POST with 404 —
 * those are retried as a GET. The response body is content and never
 * logged; failures log the method/path/status only (C4). */
export async function fetchPersona(handoff: OnairosHandoff): Promise<unknown> {
  let method: "POST" | "GET" = "POST";
  let response = await personaRequest(handoff, method);
  if (response.status === 404 || response.status === 405) {
    // The upstream has no POST route here, so the GET result is the
    // meaningful one either way.
    method = "GET";
    response = await personaRequest(handoff, method);
  }
  if (response.status === 202) {
    throw new OnairosError(
      "persona still training — try re-sync in a minute",
      503
    );
  }
  if (!response.ok) {
    console.error(
      JSON.stringify({
        msg: "onairos persona fetch failed",
        method,
        path: personaPath(personaUrl(handoff.apiUrl)),
        status: response.status,
      })
    );
    // Status code only: the body could carry grant or persona details.
    throw new OnairosError(`persona fetch failed (${response.status})`, 502);
  }
  return (await response.json()) as unknown;
}

/** Persona cache freshness window: re-syncs inside it serve the box-stored
 * copy instead of re-hitting the Persona API. */
export const PERSONA_CACHE_TTL_MS = 60 * 60 * 1000;

interface CachedPersona {
  syncedAt: string;
  persona: unknown;
}

/** Read the box-stored persona cache (onairos.json). Null when absent or
 * unreadable — callers then must fetch upstream. */
async function readCachedPersona(boxId: string): Promise<CachedPersona | null> {
  const raw = await readFile(boxId, ONAIROS_JSON_PATH).catch(() => null);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as {
      synced_at?: unknown;
      persona?: unknown;
    } | null;
    if (typeof parsed?.synced_at !== "string") return null;
    return { syncedAt: parsed.synced_at, persona: parsed.persona };
  } catch {
    return null;
  }
}

async function writeContext(
  boxId: string,
  persona: unknown,
  handoff: OnairosHandoff,
  syncedAtInput?: string
): Promise<void> {
  const syncedAt = syncedAtInput ?? new Date().toISOString();
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
  // USER.md carries a compact persona digest (the onairos-hermes-mcp shape:
  // archetype, ranked traits, summary, growth areas, platforms) so the agent
  // is personalized from the first message — replaced wholesale on re-sync.
  const user = await readFile(boxId, USER_PROFILE_PATH).catch(() => "");
  const updated = upsertPersonaBlock(user, personaBlock(persona, syncedAt));
  if (updated !== user) {
    await command(boxId, "mkdir -p .hermes/memories");
    await writeFile(boxId, USER_PROFILE_PATH, updated);
  }
  // Deep memory (docs/memory-upgrade.md): index the persona markdown at its
  // stable URI (replace-on-resync, so no duplicates). Best-effort — a
  // degraded deep-memory layer never fails a connect/re-sync.
  await deepMemoryIndex(boxId, ONAIROS_MD_PATH, OV_ONAIROS_URI);
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
): Promise<{ syncedAt: string; fromCache?: boolean }> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    const cached = await readCachedPersona(box.boxId);
    // Fresh cache: serve the box-stored persona without an upstream request.
    if (
      cached !== null &&
      Date.now() - Date.parse(cached.syncedAt) < PERSONA_CACHE_TTL_MS
    ) {
      await setStatus(supabase, userId, "active");
      return { syncedAt: cached.syncedAt, fromCache: true };
    }
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
        // Expired grant: keep serving the last-synced persona when we have
        // one — the context files on the box are still valid.
        if (cached !== null) {
          await setStatus(supabase, userId, "active");
          return { syncedAt: cached.syncedAt, fromCache: true };
        }
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
    // Deep memory: drop the indexed persona subtree too — disconnect means
    // every Onairos-derived byte leaves the box (context files AND index).
    await deepMemoryForget(box.boxId, OV_ONAIROS_URI);
    const user = await readFile(box.boxId, USER_PROFILE_PATH).catch(() => null);
    if (user !== null) {
      const updated = removePersonaBlock(user);
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
