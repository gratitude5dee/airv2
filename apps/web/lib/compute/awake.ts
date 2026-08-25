/**
 * "Get me a usable handle on this user's agent machine", whatever it runs on.
 *
 * Box environments keep going through orchestrator/boxes.ts ensureBoxAwake —
 * the resume + hosted-route refresh + stop_after handling there is unchanged.
 * Namespace instances wake through the Compute API; native ones also have to
 * answer on the template bridge before they are usable.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBoxAwake } from "../orchestrator/boxes";
import {
  waitForBridge,
  waitForInstance,
  wakeInstance,
} from "../namespace/client";
import { isBoxEnvironment, toComputeEnvironment } from "./environments";
import { targetFromRow, type ComputeTarget } from "./runtime";

export async function ensureComputeAwake(
  supabase: SupabaseClient,
  userId: string
): Promise<ComputeTarget> {
  const { data, error } = await supabase
    .from("boxes")
    .select("provider_box_id, environment, control_url, control_token, state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`compute lookup failed for user ${userId}: ${error.message}`);
  }
  if (!data) throw new Error(`no compute for user ${userId}`);
  const row = data as {
    provider_box_id: string;
    environment: string | null;
    control_url: string | null;
    control_token: string | null;
    state: string | null;
  };
  const environment = toComputeEnvironment(row.environment);
  if (isBoxEnvironment(environment)) {
    const box = await ensureBoxAwake(supabase, userId);
    return { instanceId: box.boxId, environment };
  }
  const target = targetFromRow(row);
  if (row.state !== "ready") {
    await wakeInstance(target.instanceId);
    await waitForInstance(target.instanceId);
    await supabase
      .from("boxes")
      .update({ state: "ready", last_active_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
  if (target.control) {
    await waitForBridge(
      {
        instanceId: target.instanceId,
        controlUrl: target.control.url,
        controlToken: target.control.token,
      },
      120_000
    );
  }
  return target;
}
