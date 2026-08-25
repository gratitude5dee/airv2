/**
 * M7 connector provisioning: one Composio session per user, reached from the
 * box through the /api/mcp/composio proxy (goal.md M7 task 2). Composio keeps
 * the OAuth tokens; the box gets only its own user's session endpoint.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
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
 * CM6: register Meta's official Ads MCP in the user's box. One registration
 * per box maps to one user's ad-account access; the OAuth handshake is
 * per-user and completes in the agent's own browser session inside the box.
 * `hermes mcp add` owns the config write, exactly like Composio.
 */
export const META_ADS_MCP_URL = "https://mcp.facebook.com/ads";

export async function installMetaAdsMcp(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(
    box.boxId,
    `printf 'y\\n' | /home/user/.hermes-venv/bin/hermes mcp add meta-ads --url "${META_ADS_MCP_URL}" && sudo systemctl restart hermes-gateway`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`meta ads mcp install failed: ${result.stderr}`);
  }
}

/**
 * Install (or refresh) the per-user Composio MCP endpoint in the box.
 *
 * The box is pointed at our own /api/mcp/composio proxy rather than
 * Composio's session URL: Composio's tool-router MCP endpoint requires the
 * org API key on every request, and that key must never land in a box. The
 * proxy authenticates the box by its gateway token — already present in the
 * box's own config as `model.api_key` — so the entry is written box-side
 * without any secret transiting the command line.
 */
export async function installComposioMcp(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  // Ensures the session exists before the box ever hits the proxy.
  await ensureComposioSession(supabase, userId);
  const box = await ensureBoxAwake(supabase, userId);
  const proxyUrl = `${env.appOrigin()}/api/mcp/composio`;
  const script = [
    "import yaml, pathlib",
    'p = pathlib.Path("/home/user/.hermes/config.yaml")',
    "cfg = yaml.safe_load(p.read_text()) or {}",
    'mcp = cfg.get("mcp_servers")',
    "mcp = mcp if isinstance(mcp, dict) else {}",
    `mcp["composio"] = {"url": "${proxyUrl}", "enabled": True, "headers": {"Authorization": "Bearer " + cfg["model"]["api_key"]}}`,
    'cfg["mcp_servers"] = mcp',
    "p.write_text(yaml.safe_dump(cfg, default_flow_style=False))",
  ].join("\n");
  const result = await command(
    box.boxId,
    `/home/user/.hermes-venv/bin/python - <<'PYEOF' && sudo systemctl restart hermes-gateway\n${script}\nPYEOF`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`composio mcp install failed: ${result.stderr}`);
  }
}
