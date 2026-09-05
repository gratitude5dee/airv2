/**
 * Fleet channels: 'dev' and 'prod' pointers into template_releases. Boxes
 * subscribe to a channel (boxes.channel); provisioning forks new boxes from
 * the channel's template box; fleet sync converges existing boxes to the
 * channel's release. Promotion is a pointer move — the exact artifact that
 * soaked on dev is what prod boxes receive.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
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
 *
 * With `expected` set, the move is compare-and-set: it applies only while the
 * channel still points at `expected` (null for "no release yet") and fails
 * with 409 otherwise, so a rollback can't overwrite a move that landed in
 * between reading the pointer and writing it.
 */
export async function setChannelRelease(
  supabase: SupabaseClient,
  name: ChannelName,
  releaseId: string,
  expected?: string | null
): Promise<TemplateRelease> {
  const release = await getRelease(supabase, releaseId);
  let query = supabase
    .from("box_channels")
    .update({ release_id: release.id, updated_at: new Date().toISOString() })
    .eq("name", name);
  if (expected !== undefined) {
    query =
      expected === null
        ? query.is("release_id", null)
        : query.eq("release_id", expected);
  }
  const { data, error } = await query.select("name");
  if (error) {
    throw new FleetError(`channel update failed: ${error.message}`, 500);
  }
  if (expected !== undefined && (data ?? []).length === 0) {
    const current = await getChannel(supabase, name);
    throw new FleetError(
      `channel ${name} moved to ${current.release_id ?? "none"} since it was read`,
      409
    );
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
  fallback: string | null
): Promise<string> {
  let pointer: string | null = null;
  const { data, error } = await supabase
    .from("box_environment_templates")
    .select("template_ref")
    .eq("channel", name)
    .eq("environment", environment)
    .maybeSingle();
  // A missing table (pre-migration) or a missing row both mean "not
  // registered" — fall through to the per-environment fallback.
  if (!error && data) {
    pointer = (data as { template_ref: string | null }).template_ref;
  }
  if (environment === "ubuntu" && !pointer) {
    pointer = await templateBoxFor(supabase, name, fallback ?? "");
  }
  const resolved = pointer || fallback;
  if (!resolved) {
    throw new FleetError(
      `no ${environment} template registered for channel ${name}`,
      409
    );
  }
  return resolved;
}

export async function setEnvironmentTemplate(
  supabase: SupabaseClient,
  name: ChannelName,
  environment: ComputeEnvironment,
  /** Template box id (ubuntu, omarchy) or bootstrap URL (macos). */
  templateRef: string
): Promise<void> {
  const { error } = await supabase.from("box_environment_templates").upsert(
    {
      channel: name,
      environment,
      template_ref: templateRef,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel,environment" }
  );
  if (error) {
    throw new FleetError(
      `environment template update failed: ${error.message}`,
      500
    );
  }
}
