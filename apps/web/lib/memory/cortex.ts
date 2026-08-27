/**
 * Cortex (Mitosis) memory — control-plane driver for the user's own Mitosis
 * office. The credential (`MITOSIS_API_KEY`) and office id
 * (`MITOSIS_OFFICE_ID`) live only in the box's ~/.hermes/.env (C2: the
 * control plane never holds them), so the query itself runs ON the box via
 * the command API and only the JSON result transits — box → response only,
 * never persisted (same posture as deepMemoryExport). Every call is
 * best-effort: an unconfigured or unreachable Cortex renders as a quiet
 * empty state, never an error page.
 */
import { command } from "@/lib/box/client";
import { asRecord } from "@/lib/records";

export interface CortexRecentItem {
  title: string;
  source: string;
  ageSeconds: number | null;
}

export interface CortexSource {
  label: string;
  items: number;
}

export interface CortexOverview {
  configured: boolean;
  reachable: boolean;
  officeName: string | null;
  graphUrl: string | null;
  totals: { raw: number; embedded: number; entities: number };
  sources: CortexSource[];
  recent: CortexRecentItem[];
}

export const CORTEX_UNAVAILABLE: CortexOverview = {
  configured: false,
  reachable: false,
  officeName: null,
  graphUrl: null,
  totals: { raw: 0, embedded: 0, entities: 0 },
  sources: [],
  recent: [],
};

/** Box-side probe: reads the per-user Mitosis credentials from
 * ~/.hermes/.env (never sourcing it — values may hold shell metacharacters,
 * same rule as ovctl) and calls the office-scoped MCP endpoint for a
 * manifest + the most recent memories. Prints one compact JSON object. */
const CORTEX_PROBE = `python3 - <<'PYEOF'
import json, pathlib, urllib.request

env = {}
try:
    for line in (pathlib.Path.home() / ".hermes" / ".env").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v.strip()
except OSError:
    pass
office = env.get("MITOSIS_OFFICE_ID", "")
key = env.get("MITOSIS_API_KEY", "")
if not office or not key:
    print(json.dumps({"configured": False}))
    raise SystemExit(0)

def call(name, args):
    body = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": name, "arguments": args},
    }).encode()
    req = urllib.request.Request(
        "https://mitosislabs.ai/api/mcp/o/" + office,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": "Bearer " + key,
            "X-Mitosis-Agent": "hermes",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        doc = json.loads(res.read())
    return (doc.get("result") or {}).get("structuredContent") or {}

try:
    manifest = call("cortex_manifest", {})
    recent = call("cortex_ask", {"question": "most recent facts and activity saved about the user"})
except Exception:
    print(json.dumps({"configured": True, "reachable": False}))
    raise SystemExit(0)

mem = manifest.get("memory") or {}
totals = manifest.get("totals") or {}
sources = []
for s in manifest.get("sources") or []:
    if isinstance(s, dict):
        sources.append({"label": str(s.get("label") or s.get("id") or "source"),
                        "items": s.get("items") if isinstance(s.get("items"), int) else 0})
items = []
for r in (recent.get("results") or [])[:8]:
    if isinstance(r, dict):
        items.append({
            "title": str(r.get("title") or r.get("label") or ""),
            "source": str(r.get("integration_id") or ""),
            "age_seconds": r.get("age_seconds") if isinstance(r.get("age_seconds"), (int, float)) else None,
        })
print(json.dumps({
    "configured": True,
    "reachable": True,
    "office_name": mem.get("office_name"),
    "graph_url": mem.get("graph_url"),
    "totals": {
        "raw": totals.get("raw") or 0,
        "embedded": totals.get("embedded") or 0,
        "entities": totals.get("entities") or 0,
    },
    "sources": sources,
    "recent": items,
}))
PYEOF`;

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export async function cortexOverview(boxId: string): Promise<CortexOverview> {
  const result = await command(boxId, CORTEX_PROBE, 60).catch(() => null);
  const doc =
    result && result.exitCode === 0
      ? (() => {
          try {
            return asRecord(JSON.parse(result.stdout) as unknown);
          } catch {
            return null;
          }
        })()
      : null;
  if (!doc) return CORTEX_UNAVAILABLE;
  if (doc["configured"] !== true) return CORTEX_UNAVAILABLE;
  if (doc["reachable"] !== true) {
    return { ...CORTEX_UNAVAILABLE, configured: true };
  }
  const totals = asRecord(doc["totals"]) ?? {};
  const sources: CortexSource[] = [];
  if (Array.isArray(doc["sources"])) {
    for (const entry of doc["sources"]) {
      const record = asRecord(entry);
      if (!record) continue;
      sources.push({
        label: str(record["label"]) ?? "source",
        items: num(record["items"]),
      });
    }
  }
  const recent: CortexRecentItem[] = [];
  if (Array.isArray(doc["recent"])) {
    for (const entry of doc["recent"]) {
      const record = asRecord(entry);
      if (!record) continue;
      const title = str(record["title"]);
      if (!title) continue;
      recent.push({
        title,
        source: str(record["source"]) ?? "",
        ageSeconds:
          typeof record["age_seconds"] === "number"
            ? record["age_seconds"]
            : null,
      });
    }
  }
  return {
    configured: true,
    reachable: true,
    officeName: str(doc["office_name"]),
    graphUrl: str(doc["graph_url"]),
    totals: {
      raw: num(totals["raw"]),
      embedded: num(totals["embedded"]),
      entities: num(totals["entities"]),
    },
    sources,
    recent,
  };
}
