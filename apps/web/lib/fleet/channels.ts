/**
 * Fleet channels: 'dev' and 'prod' pointers into template_releases. Boxes
 * subscribe to a channel (boxes.channel); provisioning forks new boxes from
 * the channel's template box; fleet sync converges existing boxes to the
 * channel's release. Promotion is a pointer move — the exact artifact that
 * soaked on dev is what prod boxes receive.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
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
