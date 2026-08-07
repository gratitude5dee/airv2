/**
 * AgentMail provisioning (goal.md M3 step 7): pod (client_id = user_id) →
 * inbox <username>@domain → draft-only box key → webhook → agent_addresses.
 * Idempotent: safe to re-run on username change (old addresses are retired,
 * never deleted — they route forever).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import {
  createDraftOnlyKey,
  createInbox,
  ensurePod,
  ensureWebhook,
} from "../agentmail/client";
import { command } from "../box/client";

export async function provisionEmail(
  supabase: SupabaseClient,
  userId: string,
  username: string
): Promise<{ address: string }> {
  const pod = await ensurePod(userId);
  const inbox = await createInbox(pod.pod_id, username);
  const address = `${username}@${env.agentEmailDomain()}`.toLowerCase();

  // Retire any previous primary address — it keeps routing forever.
  await supabase
    .from("agent_addresses")
    .update({ is_primary: false, retired_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_primary", true);
  const { error } = await supabase.from("agent_addresses").insert({
    user_id: userId,
    address,
    agentmail_pod_id: pod.pod_id,
    agentmail_inbox_id: inbox.inbox_id,
    is_primary: true,
  });
  if (error && error.code !== "23505") {
    throw new Error(`agent_addresses insert failed: ${error.message}`);
  }

  await ensureWebhook(`${env.appOrigin()}/api/inbound/email`, [pod.pod_id]);

  // Inject the draft-only key into the box env (C10: it cannot send).
  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (box?.provider_box_id) {
    const draftKey = await createDraftOnlyKey(`box-${userId}`);
    await command(
      box.provider_box_id as string,
      `grep -q '^AGENTMAIL_API_KEY=' /home/user/.hermes/.env && sed -i 's|^AGENTMAIL_API_KEY=.*|AGENTMAIL_API_KEY=${draftKey}|' /home/user/.hermes/.env || printf 'AGENTMAIL_API_KEY=%s\\nAGENTMAIL_INBOX_ID=%s\\n' '${draftKey}' '${inbox.inbox_id}' >> /home/user/.hermes/.env`,
      60
    ).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          msg: "box agentmail key injection failed",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    });
  }

  return { address };
}
