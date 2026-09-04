/**
 * M7 connector provisioning: one Composio session per user, reached from the
 * box through the /api/mcp/composio proxy (goal.md M7 task 2). Composio keeps
 * the OAuth tokens; the box gets only its own user's session endpoint.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { ensureComputeAwake } from "../compute/awake";
import {
  hermesBin,
  runCommand,
  type ComputeTarget,
} from "../compute/runtime";
import { profileFor, restartCommand } from "../compute/environments";
import { createSession, getSession } from "../composio/client";
import { ensureMasterkeyConnection } from "../masterkey/client";

const CONNECTED_TOOLS_TEMPLATE = `# What you can use right now (managed by air — do not edit)

## Always on (no account needed)
- Analytics: control-plane panels (spend, conversions, revenue, CAC, funnels) — skill \`analytics-interpretation\`. Always available; read them before asking to connect anything.
- Calendar: box-resident event store — skill \`calendar-native\`.
- Contacts / CRM: box-side People store — skill \`crm-people\`.
- Email: read inbox and create drafts through the mail MCP (wzrdmail or agentmail); sending goes through owner approval — skill \`email-draft-review\`.
- Vault: saved logins and secrets — skill \`vault-use\`.
- Browser: drive websites — skill \`browser-use\`.
- Mini-apps and cards on your human's phone — skill \`open-miniapp\`.

## Connected by your human
Connected: nothing yet.
Use connected apps through your composio MCP tools. If a tool fails with an auth error, say so and suggest reconnecting from the Connectors page — never ask for credentials in chat.
`;

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
  const target = await ensureComputeAwake(supabase, userId);
  const result = await runCommand(
    target,
    `printf 'y\\n' | ${hermesBin(target)} mcp add meta-ads --url "${META_ADS_MCP_URL}" && ${restartCommand(target.environment, ["hermes-gateway"])}`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`meta ads mcp install failed: ${result.stderr}`);
  }
}

/**
 * Install (or refresh) the per-user Composio MCP endpoint on the user's
 * machine — identical in every environment, only the home dir and restart
 * shell differ.
 *
 * The compute is pointed at our own /api/mcp/composio proxy rather than
 * Composio's session URL: Composio's tool-router MCP endpoint requires the
 * org API key on every request, and that key must never land in user
 * compute. The proxy authenticates the instance by its gateway token —
 * already present in its own config as `model.api_key` — so the entry is
 * written machine-side without any secret transiting the command line.
 */
export async function installComposioMcp(
  supabase: SupabaseClient,
  userId: string,
  /** Freshly provisioned instance, when the boxes row is not readable yet. */
  provisioned?: ComputeTarget
): Promise<void> {
  // Ensures the session exists before the compute ever hits the proxy.
  await ensureComposioSession(supabase, userId);
  const target = provisioned ?? (await ensureComputeAwake(supabase, userId));
  const homeDir = profileFor(target.environment).homeDir;
  const proxyUrl = `${env.appOrigin()}/api/mcp/composio`;
  const script = [
    "import yaml, pathlib",
    `p = pathlib.Path("${homeDir}/.hermes/config.yaml")`,
    "cfg = yaml.safe_load(p.read_text()) or {}",
    'mcp = cfg.get("mcp_servers")',
    "mcp = mcp if isinstance(mcp, dict) else {}",
    `mcp["composio"] = {"url": "${proxyUrl}", "enabled": True, "headers": {"Authorization": "Bearer " + cfg["model"]["api_key"]}}`,
    'cfg["mcp_servers"] = mcp',
    "p.write_text(yaml.safe_dump(cfg, default_flow_style=False))",
  ].join("\n");
  const result = await runCommand(
    target,
    `${hermesBin(target, "python")} - <<'PYEOF' && ${restartCommand(target.environment, ["hermes-gateway"])}\n${script}\nPYEOF`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`composio mcp install failed: ${result.stderr}`);
  }
}

export async function writeConnectedToolsFile(
  supabase: SupabaseClient,
  userId: string,
  provisioned?: ComputeTarget,
): Promise<void> {
  const { data: rows } = await supabase
    .from("connections")
    .select("toolkit")
    .eq("user_id", userId)
    .eq("status", "active");
  const toolkits = (rows ?? [])
    .map((row) => row.toolkit as string)
    .filter(Boolean)
    .sort();
  const connectedLine =
    toolkits.length > 0
      ? `Connected: ${toolkits.join(", ")}.`
      : "Connected: nothing yet.";
  const template = CONNECTED_TOOLS_TEMPLATE.replace(
    "Connected: nothing yet.",
    connectedLine,
  );
  const target = provisioned ?? (await ensureComputeAwake(supabase, userId));
  const homeDir = profileFor(target.environment).homeDir;
  const encodedTemplate = JSON.stringify(template).replaceAll(
    "'",
    "'\\''",
  );
  const script = [
    "import json, pathlib, sys",
    `p = pathlib.Path(${JSON.stringify(`${homeDir}/.hermes/connected-tools.md`)})`,
    "template = json.loads(sys.argv[1])",
    `connected = ${JSON.stringify(connectedLine)}`,
    "if p.exists():",
    "    lines = p.read_text().splitlines()",
    "    for i, line in enumerate(lines):",
    "        if line.startswith('Connected:'):",
    "            lines[i] = connected",
    "            break",
    "    else:",
    "        lines.append(connected)",
    "    p.write_text('\\n'.join(lines) + '\\n')",
    "else:",
    "    p.write_text(template)",
  ].join("\n");
  const result = await runCommand(
    target,
    `${hermesBin(target, "python")} - '${encodedTemplate}' <<'PYEOF'\n${script}\nPYEOF`,
    180,
  );
  if (result.exitCode !== 0) {
    throw new Error(`connected-tools write failed: ${result.stderr}`);
  }
}

/**
 * Install (or refresh) the MasterKey MCP entry on the user's machine, same
 * shape as Composio: the compute is pointed at our /api/mcp/masterkey proxy
 * and authenticates with its own gateway token. The per-user MasterKey OAuth
 * token (and the partner secret used to mint it) stay in the control plane.
 */
export async function installMasterkeyMcp(
  supabase: SupabaseClient,
  userId: string,
  /** Freshly provisioned instance, when the boxes row is not readable yet. */
  provisioned?: ComputeTarget
): Promise<void> {
  // Mints the user's MasterKey account + wallet before the compute ever hits
  // the proxy, and records the connections row.
  await ensureMasterkeyConnection(supabase, userId);
  const target = provisioned ?? (await ensureComputeAwake(supabase, userId));
  const homeDir = profileFor(target.environment).homeDir;
  const proxyUrl = `${env.appOrigin()}/api/mcp/masterkey`;
  const script = [
    "import yaml, pathlib",
    `p = pathlib.Path("${homeDir}/.hermes/config.yaml")`,
    "cfg = yaml.safe_load(p.read_text()) or {}",
    'mcp = cfg.get("mcp_servers")',
    "mcp = mcp if isinstance(mcp, dict) else {}",
    `mcp["masterkey"] = {"url": "${proxyUrl}", "enabled": True, "headers": {"Authorization": "Bearer " + cfg["model"]["api_key"]}}`,
    'cfg["mcp_servers"] = mcp',
    "p.write_text(yaml.safe_dump(cfg, default_flow_style=False))",
  ].join("\n");
  const result = await runCommand(
    target,
    `${hermesBin(target, "python")} - <<'PYEOF' && ${restartCommand(target.environment, ["hermes-gateway"])}\n${script}\nPYEOF`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`masterkey mcp install failed: ${result.stderr}`);
  }
}
