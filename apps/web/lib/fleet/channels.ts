/**
 * Fleet channels: 'dev' and 'prod' pointers into template_releases. Boxes
 * subscribe to a channel (boxes.channel); provisioning forks new boxes from
 * the channel's template box; fleet sync converges existing boxes to the
 * channel's release. Promotion is a pointer move — the exact artifact that
 * soaked on dev is what prod boxes receive.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_HARNESS, type AgentHarness } from "../agent/harness";
import type { ComputeEnvironment } from "../compute/environments";
import { FleetError, getRelease, type TemplateRelease } from "./releases";

export type ChannelName = "dev" | "prod";

export interface Channel {
  name: ChannelName;
  release_id: string | null;
  template_box_id: string | null;
  updated_at: string;
}

export function isChannelName(value: unknown): value is ChannelName {
  return value === "dev" || value === "prod";
}

export async function getChannel(
  supabase: SupabaseClient,
  name: ChannelName
): Promise<Channel> {
  const { data, error } = await supabase
    .from("box_channels")
    .select()
    .eq("name", name)
    .maybeSingle();
  if (error || !data) throw new FleetError(`channel ${name} not found`, 404);
  return data as Channel;
}

export async function listChannels(
  supabase: SupabaseClient
): Promise<Channel[]> {
  const { data, error } = await supabase.from("box_channels").select();
  if (error) throw new FleetError(`channel list failed: ${error.message}`, 500);
  return (data ?? []) as Channel[];
}

/**
 * Point a channel at a release (deploy-to-dev, promote-to-prod, and rollback
 * are all this operation with different release ids). Returns the release so
 * callers can kick a sync job for it.
 */
export async function setChannelRelease(
  supabase: SupabaseClient,
  name: ChannelName,
  releaseId: string
): Promise<TemplateRelease> {
  const release = await getRelease(supabase, releaseId);
  const { error } = await supabase
    .from("box_channels")
    .update({ release_id: release.id, updated_at: new Date().toISOString() })
    .eq("name", name);
  if (error) {
    throw new FleetError(`channel update failed: ${error.message}`, 500);
  }
  return release;
}

export async function setChannelTemplateBox(
  supabase: SupabaseClient,
  name: ChannelName,
  templateBoxId: string
): Promise<void> {
  const { error } = await supabase
    .from("box_channels")
    .update({
      template_box_id: templateBoxId,
      updated_at: new Date().toISOString(),
    })
    .eq("name", name);
  if (error) {
    throw new FleetError(`channel update failed: ${error.message}`, 500);
  }
}

/**
 * Template box a new user fork should come from: the channel's template box
 * when set, otherwise the static BOX_TEMPLATE_ID fallback the caller passes.
 */
export async function templateBoxFor(
  supabase: SupabaseClient,
  name: ChannelName,
  fallback: string
): Promise<string> {
  try {
    const channel = await getChannel(supabase, name);
    return channel.template_box_id ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Per-environment template pointer (box_environment_templates). A fork can
 * only come from a template of the same environment, so every environment
 * needs its own pointer: an Omarchy user forking the Ubuntu template would
 * silently get an Ubuntu box.
 *
 * ubuntu keeps reading box_channels (and the BOX_TEMPLATE_ID fallback) so the
 * default path is byte-identical to before this table existed. The other
 * environments have no fallback: with no pointer registered the environment
 * is unavailable, and that is an error rather than a wrong-OS box.
 */
export async function templateForEnvironment(
  supabase: SupabaseClient,
  name: ChannelName,
  environment: ComputeEnvironment,
  fallback: string | null,
  harness: AgentHarness = DEFAULT_HARNESS
): Promise<string> {
  const pointer = await registeredTemplate(supabase, name, environment, harness);
  const resolved = pointer || (harness === DEFAULT_HARNESS ? fallback : null);
  if (!resolved) {
    throw new FleetError(
      `no ${environment} template registered for ${harness} on channel ${name}`,
      409
    );
  }
  return resolved;
}

/**
 * The registered pointer for an (environment, harness) pair, or null. The
 * harness is a second axis on box_environment_templates: a Hermes pointer
 * never serves an exo user (different agent, different units), so a harness
 * without a pointer is unavailable rather than silently Hermes. Only the
 * ubuntu/hermes pair keeps reading box_channels (and BOX_TEMPLATE_ID) so the
 * default path is byte-identical to before either axis existed.
 */
export async function registeredTemplate(
  supabase: SupabaseClient,
  name: ChannelName,
  environment: ComputeEnvironment,
  harness: AgentHarness
): Promise<string | null> {
  let pointer: string | null = null;
  const { data, error } = await supabase
    .from("box_environment_templates")
    .select("template_ref")
    .eq("channel", name)
    .eq("environment", environment)
    .eq("harness", harness)
    .maybeSingle();
  // A missing table (pre-migration) or a missing row both mean "not
  // registered" — fall through to the per-environment fallback.
  if (!error && data) {
    pointer = (data as { template_ref: string | null }).template_ref;
  }
  if (environment === "ubuntu" && harness === DEFAULT_HARNESS && !pointer) {
    pointer = await templateBoxFor(supabase, name, "");
  }
  return pointer || null;
}

export async function setEnvironmentTemplate(
  supabase: SupabaseClient,
  name: ChannelName,
  environment: ComputeEnvironment,
  /** Template box id (ubuntu, omarchy) or bootstrap URL (macos). */
  templateRef: string,
  harness: AgentHarness = DEFAULT_HARNESS
): Promise<void> {
  const { error } = await supabase.from("box_environment_templates").upsert(
    {
      channel: name,
      environment,
      harness,
      template_ref: templateRef,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel,environment,harness" }
  );
  if (error) {
    throw new FleetError(
      `environment template update failed: ${error.message}`,
      500
    );
  }
}
