/**
 * M7 connector provisioning: one Composio session per user, whose hosted
 * MCP URL is installed into the user's box with `hermes mcp add` (goal.md
 * M7 task 2). Composio keeps the OAuth tokens; the box gets only its own
 * user's session endpoint.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, writeFile } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { createSession, getSession } from "../composio/client";

const HERMES_BIN = "/home/user/.hermes-venv/bin/hermes";

type EnsureAction = "none" | "added" | "updated";

function logEnsure(
  server: string,
  userId: string,
  boxId: string,
  action: EnsureAction,
  startedAt: number
): void {
  console.log(
    JSON.stringify({
      msg: "mcp ensure",
      server,
      user_id: userId,
      box_id: boxId,
      action,
      duration_ms: Date.now() - startedAt,
    })
  );
}

/**
 * Parse `hermes mcp list` output for a server entry, returning the URL on
 * its line (if any). The listing prints one server per line; a name match
 * plus URL extraction is enough to decide none/added/updated.
 */
function listedUrl(listing: string, name: string): string | null | undefined {
  for (const line of listing.split("\n")) {
    if (!new RegExp(`(^|[^a-z0-9_-])${name}([^a-z0-9_-]|$)`).test(line)) {
      continue;
    }
    const url = line.match(/https?:\/\/\S+/);
    return url ? url[0].replace(/[),.]+$/, "") : null;
  }
  return undefined; // not installed
}

/**
 * Idempotent ensure (M12): install or refresh one MCP server in the box only
 * when it is missing or its URL changed; restart the gateway only when a
 * write happened. Safe to call on every connector sync.
 */
async function ensureMcpServer(
  boxId: string,
  userId: string,
  name: string,
  url: string
): Promise<EnsureAction> {
  const startedAt = Date.now();
  const listing = await command(boxId, `${HERMES_BIN} mcp list`, 120);
  const current =
    listing.exitCode === 0 ? listedUrl(listing.stdout, name) : undefined;
  if (current === url) {
    logEnsure(name, userId, boxId, "none", startedAt);
    return "none";
  }
  const action: EnsureAction = current === undefined ? "added" : "updated";
  const result = await command(
    boxId,
    `printf 'y\\n' | ${HERMES_BIN} mcp add ${name} --url "${url}" && sudo systemctl restart hermes-gateway`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`${name} mcp ensure failed: ${result.stderr}`);
  }
  logEnsure(name, userId, boxId, action, startedAt);
  return action;
}

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
  await ensureMcpServer(box.boxId, userId, "meta-ads", META_ADS_MCP_URL);
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
  await ensureComposioMcpInstalled(supabase, userId);
}

/**
 * Idempotent Composio ensure (M12): resolve the per-user session URL, check
 * `hermes mcp list`, and add/refresh only when missing or rotated. Called
 * from the first-active hook, every connector PUT sync with ≥1 active
 * connection, provisioning, and (best-effort) post-wake.
 */
export async function ensureComposioMcpInstalled(
  supabase: SupabaseClient,
  userId: string,
  knownBoxId?: string
): Promise<EnsureAction> {
  const { mcpUrl } = await ensureComposioSession(supabase, userId);
  if (!/^https:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/.test(mcpUrl)) {
    throw new Error("unexpected composio mcp url shape");
  }
  const boxId =
    knownBoxId ?? (await ensureBoxAwake(supabase, userId)).boxId;
  return await ensureMcpServer(boxId, userId, "composio", mcpUrl);
}

function toolkitDisplayName(slug: string): string {
  return slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Tell the agent what its human has connected (M12 task 2). Display names
 * only — no tokens, no account IDs, no URLs (C10/§7.4). Best-effort: called
 * after any status flip; a sleeping box just gets the file on next ensure.
 */
export async function writeConnectedToolsFile(
  supabase: SupabaseClient,
  userId: string,
  knownBoxId?: string
): Promise<void> {
  const { data: rows } = await supabase
    .from("connections")
    .select("toolkit")
    .eq("user_id", userId)
    .eq("status", "active");
  const names = (rows ?? [])
    .map((r) => toolkitDisplayName(r.toolkit as string))
    .sort();
  const list = names.length > 0 ? names.join(", ") : "nothing yet";
  const content = [
    "# Connected tools (managed by air — do not edit)",
    `Your human has connected: ${list}.`,
    "Use them through your composio MCP tools. If a tool fails with an auth",
    "error, say so and suggest reconnecting from the Connectors page — never",
    "ask for credentials in chat.",
    "",
  ].join("\n");
  const boxId =
    knownBoxId ?? (await ensureBoxAwake(supabase, userId)).boxId;
  await writeFile(boxId, "/home/user/.hermes/connected-tools.md", content);
}
