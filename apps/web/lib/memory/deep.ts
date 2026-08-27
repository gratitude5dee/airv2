/**
 * Deep memory (docs/memory-upgrade.md, layer 2) — control-plane driver for
 * the box-local OpenViking server, via the `ovctl` binary the template bakes
 * in. Everything here is metadata-only on the control-plane side (C4): the
 * indexed bytes never leave the box, ovctl prints counts/URIs/statuses, and
 * every call is best-effort — a degraded deep-memory layer must never fail
 * onboarding or a chat turn.
 */
import { command } from "@/lib/box/client";
import { asRecord } from "@/lib/records";
import { shellQuote } from "@/lib/box/shell";

/** Stable viking:// targets — re-ingest replaces, never duplicates. */
export const OV_IMESSAGE_URI = "viking://resources/context/imessage-history";
export const OV_ONAIROS_URI = "viking://resources/context/onairos";

/** ovctl waits for indexing (`wait=True`); give large ingests headroom. */
const OVCTL_TIMEOUT_SECONDS = 600;
/** `add-resource --no-wait` only enqueues — the request-path budget stays
 * far below any platform function timeout. */
const OVCTL_ENQUEUE_TIMEOUT_SECONDS = 60;

export interface DeepMemoryStatus {
  healthy: boolean;
  resources: number;
  workspace_bytes: number;
}

function parseJson(stdout: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(stdout) as unknown);
  } catch {
    return null;
  }
}

export async function deepMemoryStatus(
  boxId: string
): Promise<DeepMemoryStatus> {
  const result = await command(boxId, "ovctl status", 60).catch(() => null);
  const doc = result && result.exitCode === 0 ? parseJson(result.stdout) : null;
  return {
    healthy: doc?.["healthy"] === true,
    resources: typeof doc?.["resources"] === "number" ? doc["resources"] : 0,
    workspace_bytes:
      typeof doc?.["workspace_bytes"] === "number" ? doc["workspace_bytes"] : 0,
  };
}

/** Index a box-local file/dir at a stable URI. Enqueue-only (`--no-wait`):
 * the server keeps indexing after the command returns, so callers on a
 * request path never stall behind embedding work. Best-effort: failures are
 * swallowed after a metadata-only log line (no path contents, no memory). */
export async function deepMemoryIndex(
  boxId: string,
  boxPath: string,
  uri: string
): Promise<boolean> {
  try {
    const result = await command(
      boxId,
      `ovctl add-resource ${shellQuote(boxPath)} --to ${shellQuote(uri)} --no-wait`,
      OVCTL_ENQUEUE_TIMEOUT_SECONDS
    );
    const ok = result.exitCode === 0;
    console.log(
      JSON.stringify({ msg: "deep memory index", box_id: boxId, uri, ok })
    );
    return ok;
  } catch {
    console.log(
      JSON.stringify({ msg: "deep memory index", box_id: boxId, uri, ok: false })
    );
    return false;
  }
}

/** Remove an indexed subtree (e.g. Onairos disconnect). Best-effort. */
export async function deepMemoryForget(
  boxId: string,
  uri: string
): Promise<boolean> {
  try {
    const result = await command(
      boxId,
      `ovctl rm ${shellQuote(uri)}`,
      OVCTL_TIMEOUT_SECONDS
    );
    const ok = result.exitCode === 0;
    console.log(
      JSON.stringify({ msg: "deep memory forget", box_id: boxId, uri, ok })
    );
    return ok;
  } catch {
    console.log(
      JSON.stringify({ msg: "deep memory forget", box_id: boxId, uri, ok: false })
    );
    return false;
  }
}

/** Re-render ov.conf from the box's .env and re-index the onboarding context
 * (imessage-history/ + onairos.md). Owner-triggered from Settings. */
export async function deepMemoryReindex(boxId: string): Promise<boolean> {
  try {
    const ensure = await command(boxId, "ovctl ensure", 180);
    if (ensure.exitCode !== 0) return false;
    const result = await command(boxId, "ovctl reindex", OVCTL_TIMEOUT_SECONDS);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export interface DeepMemoryEntry {
  uri: string;
  preview: string;
}

export interface DeepMemoryHistory {
  resources: string[];
  memories: DeepMemoryEntry[];
}

/** Recent OpenViking-derived memories + indexed resource URIs for the
 * owner's Persona view. Same posture as export: the returned text is
 * CONTENT — box → response only, never persisted. Best-effort: an
 * unreachable or empty store renders as an empty history. */
export async function deepMemoryHistory(
  boxId: string,
  limit = 12
): Promise<DeepMemoryHistory> {
  const result = await command(boxId, "ovctl export", 120).catch(() => null);
  const doc = result && result.exitCode === 0 ? parseJson(result.stdout) : null;
  if (!doc) return { resources: [], memories: [] };
  const resources = Array.isArray(doc["resources"])
    ? doc["resources"].filter((uri): uri is string => typeof uri === "string")
    : [];
  const memories: DeepMemoryEntry[] = [];
  if (Array.isArray(doc["memories"])) {
    for (const entry of doc["memories"]) {
      const record = asRecord(entry);
      if (!record || typeof record["uri"] !== "string") continue;
      const content =
        typeof record["content"] === "string" ? record["content"] : "";
      if (!content) continue;
      memories.push({
        uri: record["uri"],
        preview: content.slice(0, 240),
      });
      if (memories.length >= limit) break;
    }
  }
  return { resources, memories };
}

/** Export inventory + derived memory contents for /api/admin/export. The
 * returned object is CONTENT — box → response only, never persisted. */
export async function deepMemoryExport(
  boxId: string
): Promise<Record<string, unknown>> {
  const result = await command(boxId, "ovctl export", 120).catch(() => null);
  if (!result || result.exitCode !== 0) {
    return { error: "openviking unavailable — deep memory rides the box snapshot" };
  }
  return (
    parseJson(result.stdout) ?? {
      error: "openviking export unreadable — deep memory rides the box snapshot",
    }
  );
}
