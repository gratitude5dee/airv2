/**
 * M7 connector provisioning: one Composio session per user, whose hosted
 * MCP URL is installed into the user's box with `hermes mcp add` (goal.md
 * M7 task 2). Composio keeps the OAuth tokens; the box gets only its own
 * user's session endpoint.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { createSession, getSession } from "../composio/client";

export async function ensureComposioSession(
  supabase: SupabaseClient,
  userId: string
): Promise<{ sessionId: string; mcpUrl: string }> {
  const { data } = await supabase
    .from("users")
    .select("composio_session_id")
    .eq("id", userId)
    .maybeSingle();
  const existing = data?.composio_session_id as string | null | undefined;
  if (existing) {
    const session = await getSession(existing);
    if (session.mcp?.url) {
      return { sessionId: existing, mcpUrl: session.mcp.url };
    }
  }
  const session = await createSession(userId);
  if (!session.mcp?.url) {
    throw new Error("composio session has no MCP endpoint");
  }
  await supabase
    .from("users")
    .update({ composio_session_id: session.session_id })
    .eq("id", userId);
  return { sessionId: session.session_id, mcpUrl: session.mcp.url };
}

/**
 * Install (or refresh) the per-user Composio MCP endpoint in the box.
 * `hermes mcp add` validates the entry; the trailing `y` answers its
 * save-anyway prompt so a transient connect hiccup doesn't abort install.
 */
export async function installComposioMcp(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { mcpUrl } = await ensureComposioSession(supabase, userId);
  if (!/^https:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/.test(mcpUrl)) {
    throw new Error("unexpected composio mcp url shape");
  }
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(
    box.boxId,
    `printf 'y\\n' | /home/user/hermes-agent/.venv/bin/hermes mcp add composio --url "${mcpUrl}" && sudo systemctl restart hermes-gateway`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`composio mcp install failed: ${result.stderr}`);
  }
}
