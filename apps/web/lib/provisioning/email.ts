/**
 * Mail provisioning (goal.md M3 step 7): pod (client_id = user_id) →
 * inbox <username>@domain → draft-only box key → webhook → agent_addresses.
 * Provider-neutral via lib/mail/client (MAIL_PROVIDER); only the box-side
 * env-var names and MCP server differ per provider.
 * Idempotent: safe to re-run on username change (old addresses are retired,
 * never deleted — they route forever).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import {
  MailApiError,
  createDraftOnlyKeyForProvider,
  createInbox,
  ensurePod,
  ensureWebhook,
  mailProvider,
  type MailProvider,
} from "../mail/client";
import { BoxApiError, command, readFile, writeFile } from "../box/client";

interface BoxMailWiring {
  /** Hermes mcp_servers entry name. */
  mcpName: string;
  mcpUrl: string;
  /** Prefix of the .hermes/.env vars this provider owns (replaced on re-run). */
  envPrefix: string;
  apiKeyVar: string;
  inboxIdVar: string;
}

/** Which env names / hosted MCP the box gets for the active provider. */
export function boxMailWiring(provider: MailProvider = mailProvider()): BoxMailWiring {
  if (provider === "wzrdmail") {
    return {
      mcpName: "wzrdmail",
      mcpUrl: env.wzrdmailMcpUrl(),
      envPrefix: "WZRDMAIL_",
      apiKeyVar: "WZRDMAIL_API_KEY",
      inboxIdVar: "WZRDMAIL_INBOX_ID",
    };
  }
  return {
    mcpName: "agentmail",
    mcpUrl: "https://mcp.agentmail.to/mcp",
    envPrefix: "AGENTMAIL_",
    apiKeyVar: "AGENTMAIL_API_KEY",
    inboxIdVar: "AGENTMAIL_INBOX_ID",
  };
}

/**
 * Registers the provider's hosted MCP server in the box's Hermes config
 * (goal.md M3 step 7). The header holds only the `${<PROVIDER>_API_KEY}`
 * interpolation template — Hermes resolves it from ~/.hermes/.env at
 * connect time, so no secret appears in the command line or config file.
 * The other provider's entry is disabled so the box has exactly one mail MCP.
 */
export function mailMcpInstallScript(wiring: BoxMailWiring): string {
  const other = wiring.mcpName === "wzrdmail" ? "agentmail" : "wzrdmail";
  return [
    "import yaml",
    'cf = "/home/user/.hermes/config.yaml"',
    "c = yaml.safe_load(open(cf)) or {}",
    's = c.setdefault("mcp_servers", {})',
    `s[${JSON.stringify(wiring.mcpName)}] = {"url": ${JSON.stringify(wiring.mcpUrl)}, "headers": {"x-api-key": "\${${wiring.apiKeyVar}}"}, "enabled": True}`,
    `if ${JSON.stringify(other)} in s: s[${JSON.stringify(other)}]["enabled"] = False`,
    "yaml.safe_dump(c, open(cf, 'w'), default_flow_style=False, sort_keys=False)",
  ].join("\n");
}

async function installMailMcp(boxId: string, wiring: BoxMailWiring): Promise<void> {
  const result = await command(
    boxId,
    `python3 - <<'PYEOF'\n${mailMcpInstallScript(wiring)}\nPYEOF\nsudo systemctl restart hermes-gateway`,
    120
  );
  if (result.exitCode !== 0) {
    throw new Error(`${wiring.mcpName} mcp install failed: ${result.stderr}`);
  }
}

export async function installMailboxOnBox(
  boxId: string,
  userId: string,
  inboxId: string,
  provider: MailProvider = mailProvider(),
): Promise<void> {
  const wiring = boxMailWiring(provider);
  const draftKey = await createDraftOnlyKeyForProvider(
    provider,
    inboxId,
    `box-${userId}`,
  );
  // Keep the credential out of command arguments and process listings.
  let current: string;
  try {
    current = await readFile(boxId, ".hermes/.env");
  } catch (error) {
    if (!(error instanceof BoxApiError) || error.status !== 404) throw error;
    current = "";
  }
  const kept = current
    .split("\n")
    .filter((line) => line && !line.startsWith(wiring.envPrefix));
  kept.push(`${wiring.apiKeyVar}=${draftKey}`);
  kept.push(`${wiring.inboxIdVar}=${inboxId}`);
  await writeFile(boxId, ".hermes/.env", kept.join("\n") + "\n");
  await installMailMcp(boxId, wiring);
}

export async function installExistingMailbox(
  supabase: SupabaseClient,
  userId: string,
  boxId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("retired_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`agent address lookup failed: ${error.message}`);
  }
  if (!data?.agentmail_inbox_id) return false;
  const provider = mailProvider();
  try {
    await installMailboxOnBox(
      boxId,
      userId,
      data.agentmail_inbox_id as string,
      provider,
    );
  } catch (error) {
    if (!(error instanceof MailApiError) || error.status !== 404) throw error;
    await installMailboxOnBox(
      boxId,
      userId,
      data.agentmail_inbox_id as string,
      provider === "wzrdmail" ? "agentmail" : "wzrdmail",
    );
  }
  return true;
}

export async function provisionEmail(
  supabase: SupabaseClient,
  userId: string,
  username: string
): Promise<{ address: string }> {
  // Reuse the existing address and refresh its current box wiring.
  const desired = `${username}@${env.agentEmailDomain()}`.toLowerCase();
  const { data: existing } = await supabase
    .from("agent_addresses")
    .select("address, agentmail_inbox_id")
    .eq("user_id", userId)
    .eq("address", desired)
    .is("retired_at", null)
    .maybeSingle();
  if (existing) {
    const { data: box } = await supabase
      .from("boxes")
      .select("provider_box_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (box?.provider_box_id && existing.agentmail_inbox_id) {
      const boxId = box.provider_box_id as string;
      try {
        await installMailboxOnBox(
          boxId,
          userId,
          existing.agentmail_inbox_id as string,
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "box mail key injection failed",
            user_id: userId,
            box_id: boxId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    return { address: desired };
  }

  const pod = await ensurePod(userId);
  // The shared beta domain is global: the username may be taken there even
  // though it's unique in our users table. Fall back to AgentMail's
  // suggestion rather than failing provisioning.
  let inboxUsername = username;
  let inbox;
  try {
    inbox = await createInbox(pod.pod_id, inboxUsername);
  } catch (error) {
    if (error instanceof MailApiError && error.status === 403) {
      let suggestion: string | undefined;
      try {
        suggestion = (JSON.parse(error.message) as { suggestions?: string[] })
          .suggestions?.[0];
      } catch {
        suggestion = undefined;
      }
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
    const wiring = boxMailWiring();
    try {
      await installMailboxOnBox(boxId, userId, inbox.inbox_id);
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: `box ${wiring.mcpName} key injection failed`,
          user_id: userId,
          box_id: boxId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  return { address };
}
