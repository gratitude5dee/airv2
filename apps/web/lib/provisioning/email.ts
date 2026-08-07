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
import { command, readFile, writeFile } from "../box/client";

/**
 * Registers AgentMail's hosted MCP server in the box's Hermes config
 * (goal.md M3 step 7). The header holds only the `${AGENTMAIL_API_KEY}`
 * interpolation template — Hermes resolves it from ~/.hermes/.env at
 * connect time, so no secret appears in the command line or config file.
 */
async function installAgentmailMcp(boxId: string): Promise<void> {
  const script = [
    "import yaml",
    'cf = "/home/user/.hermes/config.yaml"',
    "c = yaml.safe_load(open(cf)) or {}",
    's = c.setdefault("mcp_servers", {})',
    's["agentmail"] = {"url": "https://mcp.agentmail.to/mcp", "headers": {"x-api-key": "${AGENTMAIL_API_KEY}"}, "enabled": True}',
    "yaml.safe_dump(c, open(cf, 'w'), default_flow_style=False, sort_keys=False)",
  ].join("\n");
  const result = await command(
    boxId,
    `python3 - <<'PYEOF'\n${script}\nPYEOF\nsudo systemctl restart hermes-gateway`,
    120
  );
  if (result.exitCode !== 0) {
    throw new Error(`agentmail mcp install failed: ${result.stderr}`);
  }
}

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
    const boxId = box.provider_box_id as string;
    try {
      const draftKey = await createDraftOnlyKey(`box-${userId}`);
      // Typed file read/write only — the key must never appear in a shell
      // command line (visible in command logs / process listings).
      const current = await readFile(boxId, ".hermes/.env").catch(() => "");
      const kept = current
        .split("\n")
        .filter((line) => line && !line.startsWith("AGENTMAIL_"));
      kept.push(`AGENTMAIL_API_KEY=${draftKey}`);
      kept.push(`AGENTMAIL_INBOX_ID=${inbox.inbox_id}`);
      await writeFile(boxId, ".hermes/.env", kept.join("\n") + "\n");
      await installAgentmailMcp(boxId);
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "box agentmail key injection failed",
          user_id: userId,
          box_id: boxId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  return { address };
}
