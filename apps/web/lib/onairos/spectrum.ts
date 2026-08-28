/**
 * Onairos ↔ Spectrum connect relay (.agents/skills/onairos-spectrum-connect).
 * The control plane forwards the owner's own iMessage text to Onairos and
 * sends the returned reply back into the same Spectrum space; Onairos runs
 * the email/verification/consent conversation itself. We never synthesize an
 * email, code, or YES on the user's behalf — consent stays with the user.
 *
 * Postgres holds routing metadata only: a connections row (provider onairos,
 * toolkit spectrum) whose `pending` status is the shouldRouteNextMessage
 * flag. Returned grant records are content-adjacent authorization state and
 * live box-side only (C4), like the persona grant in ./sync.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, writeFile } from "@/lib/box/client";
import { shellQuote } from "@/lib/box/shell";
import { env } from "@/lib/env";
import { requestSignal } from "@/lib/http/timeout";
import { writeStatusMirror } from "@/lib/miniapps/onboardingMirror";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { markOnboardingStep } from "@/lib/miniapps/onboarding";
import { OnairosError } from "./context";

const PROVIDER = "onairos";
const TOOLKIT = "spectrum";

export const ONAIROS_SPECTRUM_GRANTS_PATH =
  ".hermes/context/.onairos-spectrum-grants.json";

const ENDPOINT = "https://api2.onairos.uk/integrations/spectrum/text/command";

/** Owner phrase that opens the connect flow ("connect onairos", "connect my
 * onairos account", ...). Everything after that routes on the pending flag. */
export function isOnairosTrigger(text: string): boolean {
  return /\bconnect\w*[^.!?\n]*\bonairos\b|\bonairos\b[^.!?\n]*\bconnect\w*/i.test(
    text,
  );
}

export interface OnairosGrant {
  grantId: string;
  status: string;
}

export interface OnairosRelayResult {
  /** Text to send back into the same Spectrum conversation, when present. */
  reply: string | null;
  /** Keep routing this conversation's messages to Onairos while true. */
  shouldRouteNextMessage: boolean;
  /** Grant records — present means the user consented (their own YES). */
  grants: OnairosGrant[];
}

export interface OnairosRelayInput {
  /** Stable per-conversation id — the Spectrum space id. */
  sessionId: string;
  /** Stable sender id (iMessage handle) for the same person every message. */
  senderId: string;
  phone: string;
  text: string;
}

function parseGrants(value: unknown): OnairosGrant[] {
  if (!Array.isArray(value)) return [];
  const grants: OnairosGrant[] = [];
  for (const entry of value) {
    const record = entry as { grantId?: unknown; status?: unknown } | null;
    if (record && typeof record.grantId === "string") {
      grants.push({
        grantId: record.grantId,
        status: typeof record.status === "string" ? record.status : "active",
      });
    }
  }
  return grants;
}

/** Forward one inbound message to Onairos. The reply/grants in the response
 * are content — callers must never log them. */
export async function relayToOnairos(
  input: OnairosRelayInput,
): Promise<OnairosRelayResult> {
  const apiKey = env.onairosApiKey();
  if (apiKey === null) {
    throw new OnairosError("ONAIROS_API_KEY not configured", 503);
  }
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: input.sessionId,
      channel: "iMessage",
      user: { id: input.senderId, phone: input.phone },
      message: { text: input.text },
      metadata: { agentId: "air-hermes", agentName: "AIR", linkPage: true },
    }),
    signal: requestSignal(30_000),
  });
  if (!response.ok) {
    // Status only: the body could carry conversation or grant details.
    throw new OnairosError(`onairos relay failed (${response.status})`, 502);
  }
  const body = (await response.json().catch(() => null)) as {
    reply?: unknown;
    onairos?: { shouldRouteNextMessage?: unknown } | null;
    grants?: unknown;
  } | null;
  return {
    reply: typeof body?.reply === "string" ? body.reply : null,
    shouldRouteNextMessage: body?.onairos?.shouldRouteNextMessage === true,
    grants: parseGrants(body?.grants),
  };
}

/** True while the Spectrum connect conversation is mid-flow — the persisted
 * shouldRouteNextMessage flag. */
export async function spectrumFlowActive(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("connections")
    .select("status")
    .eq("user_id", userId)
    .eq("provider", PROVIDER)
    .eq("toolkit", TOOLKIT)
    .maybeSingle();
  return data?.status === "pending";
}

/** Statuses limited to the connections_status_check set (0001_init.sql):
 * `pending` = mid-flow (route next message), `active` = granted, `error` =
 * flow ended without grants — anything non-pending exits the routing loop. */
export async function setSpectrumFlow(
  supabase: SupabaseClient,
  userId: string,
  status: "pending" | "error" | "active",
): Promise<void> {
  const { error } = await supabase.from("connections").upsert(
    {
      user_id: userId,
      provider: PROVIDER,
      toolkit: TOOLKIT,
      status,
      connected_at: status === "active" ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,provider,toolkit" },
  );
  if (error) {
    console.error(
      JSON.stringify({
        msg: "onairos spectrum flow update failed",
        user_id: userId,
        status,
        error: error.message,
      }),
    );
  }
}

/** Persist grant records box-side (0600, vault-key custody model), flip the
 * connection to active, and complete the onboarding onairos step. */
export async function storeSpectrumGrants(
  supabase: SupabaseClient,
  userId: string,
  grants: OnairosGrant[],
): Promise<void> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    const mkdir = await command(box.boxId, "mkdir -p .hermes/context");
    if (mkdir.exitCode !== 0) throw new OnairosError("box write failed", 502);
    await writeFile(
      box.boxId,
      ONAIROS_SPECTRUM_GRANTS_PATH,
      JSON.stringify({ granted_at: new Date().toISOString(), grants }, null, 2),
    );
    await command(
      box.boxId,
      `chmod 600 ${shellQuote(ONAIROS_SPECTRUM_GRANTS_PATH)}`,
    );
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
  await setSpectrumFlow(supabase, userId, "active");
  await markOnboardingStep(supabase, userId, "onairos", "done")
    .then((state) => writeStatusMirror(supabase, userId, { state }))
    .catch(() => undefined);
}
