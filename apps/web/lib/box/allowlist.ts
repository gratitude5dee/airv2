/**
 * Allowlists for the /api/box/* proxy. Allowlist, never denylist: anything
 * not listed returns 404 (C5).
 */

export type Upstream = "api_server" | "dashboard";

// Served by api_server (8642).
const ALLOWLIST: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: "GET", pattern: /^api\/sessions$/ },
  { method: "GET", pattern: /^api\/sessions\/[A-Za-z0-9_-]+$/ },
  { method: "GET", pattern: /^api\/sessions\/[A-Za-z0-9_-]+\/messages$/ },
  { method: "GET", pattern: /^v1\/skills$/ },
  { method: "GET", pattern: /^v1\/toolsets$/ },
  { method: "GET", pattern: /^api\/mcp\/servers$/ },
  { method: "GET", pattern: /^api\/jobs$/ },
  // V3 calendar: the Hermes cron jobs API — exact paths, never prefixes (C5).
  { method: "POST", pattern: /^api\/jobs$/ },
  { method: "GET", pattern: /^api\/jobs\/[A-Za-z0-9_-]+$/ },
  { method: "PATCH", pattern: /^api\/jobs\/[A-Za-z0-9_-]+$/ },
  { method: "DELETE", pattern: /^api\/jobs\/[A-Za-z0-9_-]+$/ },
  { method: "POST", pattern: /^api\/jobs\/[A-Za-z0-9_-]+\/pause$/ },
  { method: "POST", pattern: /^api\/jobs\/[A-Za-z0-9_-]+\/resume$/ },
  { method: "POST", pattern: /^api\/jobs\/[A-Za-z0-9_-]+\/run$/ },
  // V7 bots: the same jobs API multiplexed under a profile prefix
  // (/p/<name>/…, name = [a-z0-9-]{2,32} per the bots row). Still exact
  // (method, path) pairs — the prefix widens the path shape, never the
  // set of reachable endpoints (C5).
  { method: "GET", pattern: /^p\/[a-z0-9-]{2,32}\/api\/jobs$/ },
  { method: "POST", pattern: /^p\/[a-z0-9-]{2,32}\/api\/jobs$/ },
  { method: "GET", pattern: /^p\/[a-z0-9-]{2,32}\/api\/jobs\/[A-Za-z0-9_-]+$/ },
  { method: "PATCH", pattern: /^p\/[a-z0-9-]{2,32}\/api\/jobs\/[A-Za-z0-9_-]+$/ },
  { method: "DELETE", pattern: /^p\/[a-z0-9-]{2,32}\/api\/jobs\/[A-Za-z0-9_-]+$/ },
  { method: "POST", pattern: /^p\/[a-z0-9-]{2,32}\/api\/jobs\/[A-Za-z0-9_-]+\/pause$/ },
  { method: "POST", pattern: /^p\/[a-z0-9-]{2,32}\/api\/jobs\/[A-Za-z0-9_-]+\/resume$/ },
  { method: "POST", pattern: /^p\/[a-z0-9-]{2,32}\/api\/jobs\/[A-Za-z0-9_-]+\/run$/ },
];

// Served by the dashboard (9119), which requires the box's basic-auth
// credential — persisted sealed in boxes.dashboard_auth (CM1 task 0 / CC10).
// Exactly the creative plugin surface, path by path (C5): adding
// api/plugins/creative/jobs does not add api/plugins/. Asset bytes are
// deliberately absent — lib/assets pulls them server-to-server (C3, C16).
const DASHBOARD_ALLOWLIST: ReadonlyArray<{ method: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^api\/plugins\/creative\/jobs$/ },
  { method: "GET", pattern: /^api\/plugins\/creative\/jobs\/[A-Za-z0-9_-]+$/ },
  {
    method: "POST",
    pattern: /^api\/plugins\/creative\/jobs\/[A-Za-z0-9_-]+\/cancel$/,
  },
  { method: "GET", pattern: /^api\/plugins\/creative\/assets$/ },
  {
    method: "POST",
    pattern: /^api\/plugins\/creative\/assets\/[A-Za-z0-9_-]+\/variants$/,
  },
  { method: "GET", pattern: /^api\/plugins\/creative\/packages\/[A-Za-z0-9_-]+$/ },
  { method: "GET", pattern: /^api\/plugins\/creative\/brand$/ },
];

export function resolveUpstream(method: string, path: string): Upstream | null {
  if (
    ALLOWLIST.some(
      (entry) => entry.method === method && entry.pattern.test(path)
    )
  ) {
    return "api_server";
  }
  if (
    DASHBOARD_ALLOWLIST.some(
      (entry) => entry.method === method && entry.pattern.test(path)
    )
  ) {
    return "dashboard";
  }
  return null;
}
