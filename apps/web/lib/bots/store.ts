/**
 * Bot metadata rows (V7). Postgres is routing metadata only: profile name,
 * display fields, tier pin, per-profile key, status. Chat bodies, memory,
 * skills, and routine prompts live in ~/.hermes/profiles/<name>/ on the box
 * (C4). api_server_key never reaches a browser (C3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type BotAvatarKind = "geometric" | "image" | "generated" | "pet";
export type BotModelTier = "fast" | "balanced" | "deep";
export type BotStatus = "provisioning" | "ready" | "error" | "deleted";

export interface BotRow {
  id: string;
  user_id: string;
  name: string;
  title: string | null;
  description: string | null;
  avatar_kind: BotAvatarKind;
  avatar_ref: string | null;
  model_tier: BotModelTier | null;
  api_server_key: string;
  status: BotStatus;
  group_label: string | null;
  created_at: string;
}

const BOT_COLUMNS =
  "id, user_id, name, title, description, avatar_kind, avatar_ref, model_tier, api_server_key, status, group_label, created_at";

export async function listBots(
  supabase: SupabaseClient,
  userId: string
): Promise<BotRow[]> {
  const { data, error } = await supabase
    .from("bots")
    .select(BOT_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "deleted")
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`bots select failed: ${error.message}`);
  }
  return (data ?? []) as BotRow[];
}

export async function getBot(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<BotRow | null> {
  const { data, error } = await supabase
    .from("bots")
    .select(BOT_COLUMNS)
    .eq("user_id", userId)
    .eq("name", name)
    .neq("status", "deleted")
    .maybeSingle();
  if (error) {
    throw new Error(`bot lookup failed: ${error.message}`);
  }
  return (data as BotRow | null) ?? null;
}

/** The browser-safe projection: everything except the per-profile key. */
export interface BotPublic {
  name: string;
  title: string | null;
  description: string | null;
  avatar_kind: BotAvatarKind;
  avatar_ref: string | null;
  model_tier: BotModelTier | null;
  status: BotStatus;
  group_label: string | null;
  created_at: string;
}

export function toPublic(bot: BotRow): BotPublic {
  return {
    name: bot.name,
    title: bot.title,
    description: bot.description,
    avatar_kind: bot.avatar_kind,
    avatar_ref: bot.avatar_ref,
    model_tier: bot.model_tier,
    status: bot.status,
    group_label: bot.group_label,
    created_at: bot.created_at,
  };
}
