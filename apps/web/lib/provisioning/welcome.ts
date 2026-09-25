/**
 * Post-provision welcome for self-serve signups: once the user's compute
 * exists, they get the Spectrum-app pointer and then the onboarding card.
 * Operator-invited accounts have no imessage_destinations row (their invite
 * link is the welcome), so the sends no-op for them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMiniAppCard } from "../miniapps/cards";
import { createSpectrumSender } from "../spectrum/sender";
import { ensureComputeProvisioned } from "./provision";

const WELCOME_TEXT =
  "Welcome to air by WZRD.tech, for the full experience download the Spectrum App on the app store : https://apps.apple.com/ng/app/spectrum-apps-in-messages/id6777616651";

export interface ComputeReadySend {
  welcomed: boolean;
  cardSent: boolean;
}

export async function sendComputeReadyMessages(
  supabase: SupabaseClient,
  userId: string
): Promise<ComputeReadySend> {
  const { data: dest } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  const spaceId = dest?.space_id ? String(dest.space_id) : "";
  const phone = dest?.phone ? String(dest.phone) : "";
  if (!spaceId || !phone) {
    return { welcomed: false, cardSent: false };
  }
  let welcomed = false;
  const sender = await createSpectrumSender();
  try {
    await sender.sendText(spaceId, phone, WELCOME_TEXT);
    welcomed = true;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "compute welcome text send failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  } finally {
    await sender.close().catch(() => undefined);
  }
  let cardSent = false;
  try {
    await sendMiniAppCard(
      supabase,
      spaceId,
      phone,
      userId,
      "onboarding",
      "default"
    );
    cardSent = true;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "compute onboarding card send failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
  }
  return { welcomed, cardSent };
}

/**
 * ensureComputeProvisioned plus the welcome delivery when it actually
 * builds: the sends follow a successful fork so a still-provisioning retry
 * doesn't re-notify. Returns {created:false} sends untouched when a boxes
 * row already exists.
 */
export async function provisionComputeWithWelcome(
  supabase: SupabaseClient,
  userId: string
): Promise<{ created: boolean } & ComputeReadySend> {
  const created = await ensureComputeProvisioned(supabase, userId);
  if (!created) {
    return { created: false, welcomed: false, cardSent: false };
  }
  const sent = await sendComputeReadyMessages(supabase, userId);
  return { created: true, ...sent };
}
