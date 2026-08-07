/**
 * AgentMail provisioning (goal.md M3 step 7): pod (client_id = user_id) →
 * inbox <username>@domain → draft-only box key → webhook → agent_addresses.
 * Idempotent: safe to re-run on username change (old addresses are retired,
 * never deleted — they route forever).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import {
  AgentMailApiError,
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
  // Already provisioned for this exact address? Idempotent no-op.
  const desired = `${username}@${env.agentEmailDomain()}`.toLowerCase();
  const { data: existing } = await supabase
    .from("agent_addresses")
    .select("address")
    .eq("user_id", userId)
    .eq("address", desired)
    .is("retired_at", null)
    .maybeSingle();
  if (existing) return { address: desired };

  const pod = await ensurePod(userId);
  // The shared beta domain is global: the username may be taken there even
  // though it's unique in our users table. Fall back to AgentMail's
  // suggestion rather than failing provisioning.
  let inboxUsername = username;
  let inbox;
  try {
    inbox = await createInbox(pod.pod_id, inboxUsername);
  } catch (error) {
    if (error instanceof AgentMailApiError && error.status === 403) {
      const parsed = JSON.parse(error.message) as { suggestions?: string[] };
      const suggestion = parsed.suggestions?.[0];
      if (!suggestion) throw error;
      inboxUsername = suggestion;
      inbox = await createInbox(pod.pod_id, inboxUsername);
    } else {
      throw error;
    }
  }
  const address = `${inboxUsername}@${env.agentEmailDomain()}`.toLowerCase();

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
