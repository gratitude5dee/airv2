import type { SupabaseClient } from "@supabase/supabase-js";
import type { CardKind } from "./cardSends";

export interface MiniAppCardSession {
  chatGuid: string;
  messageGuid: string;
  sessionId: string;
  targetMessageGuid: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseMiniAppCardSession(
  value: unknown
): MiniAppCardSession | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !nonEmptyString(value["chatGuid"]) ||
    !nonEmptyString(value["messageGuid"]) ||
    !nonEmptyString(value["sessionId"]) ||
    !nonEmptyString(value["targetMessageGuid"])
  ) {
    return undefined;
  }
  return {
    chatGuid: value["chatGuid"],
    messageGuid: value["messageGuid"],
    sessionId: value["sessionId"],
    targetMessageGuid: value["targetMessageGuid"],
  };
}

export async function readMiniAppCardSession(
  supabase: SupabaseClient,
  userId: string,
  kind: CardKind,
  resourceId: string
): Promise<MiniAppCardSession | undefined> {
  const { data, error } = await supabase
    .from("miniapp_card_sessions")
    .select("session")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("resource_id", resourceId)
    .maybeSingle();
  if (error) {
    throw new Error(`miniapp card session read failed: ${error.message}`);
  }
  return parseMiniAppCardSession(data?.session);
}

export async function upsertMiniAppCardSession(
  supabase: SupabaseClient,
  userId: string,
  kind: CardKind,
  resourceId: string,
  spaceId: string,
  session: MiniAppCardSession
): Promise<void> {
  const { error } = await supabase.from("miniapp_card_sessions").upsert(
    {
      user_id: userId,
      kind,
      resource_id: resourceId,
      space_id: spaceId,
      session,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind,resource_id" }
  );
  if (error) {
    throw new Error(`miniapp card session upsert failed: ${error.message}`);
  }
}

export async function deleteMiniAppCardSession(
  supabase: SupabaseClient,
  userId: string,
  kind: CardKind,
  resourceId: string
): Promise<void> {
  const { error } = await supabase
    .from("miniapp_card_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("resource_id", resourceId);
  if (error) {
    throw new Error(`miniapp card session delete failed: ${error.message}`);
  }
}
