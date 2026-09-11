/**
 * Inventory classification (plan §4): every durable path is classified
 * transfer / regenerate / reconnect / exclude; nothing is silently dropped,
 * and an unclassified durable path blocks "complete". The box-side script
 * emits raw entries (path, kind, size, hash); the policy lives here so the
 * classifier is versioned with the control plane, not the box template.
 *
 * Deliberate deviations from the repo's other transfer paths: .git is NOT
 * blanket-excluded (agent-owned repos lose unpushed work otherwise), and the
 * vault store is excluded outright — without AIR_VAULT_KEY it is ciphertext
 * no side can read, and vault-bearing accounts fail preflight anyway (C18).
 */
import type {
  InventoryClass,
  ManifestEntry,
  MigrationManifest,
} from "./types";

/** Raw entry shape emitted by air_transfer.py inventory. */
export interface ScannedEntry {
  path: string;
  kind: "file" | "symlink" | "sqlite";
  bytes: number;
  sha256: string;
  mtime: number;
}

interface Rule {
  test: (path: string, kind: string) => boolean;
  classification: InventoryClass;
  reason?: string;
}

const RULES: Rule[] = [
  // Migration's own bookkeeping — never crosses.
  { test: (p) => p === ".air" || p.startsWith(".air/"), classification: "exclude", reason: "migration-state" },
  // Vault: ciphertext without the box-local key. Presence of a real vault
  // store is a preflight blocker, so this rule only ever meets an empty file.
  { test: (p) => p === ".hermes/vault" || p.startsWith(".hermes/vault/"), classification: "exclude", reason: "vault" },
  // Per-box credentials and env: the candidate gets fresh ones staged.
  { test: (p) => /^\.hermes\/\.env(\..*)?$/.test(p), classification: "regenerate", reason: "env-scoped" },
  { test: (p) => p === ".hermes/.template-hermes-ref" || p === ".hermes/.template-release" || p === ".hermes/.template-skills", classification: "regenerate", reason: "template-stamp" },
  // The agent runtime itself is re-forked from the target template.
  { test: (p) => p === "hermes-agent" || p.startsWith("hermes-agent/"), classification: "regenerate", reason: "template" },
  { test: (p) => p === ".hermes-venv" || p.startsWith(".hermes-venv/"), classification: "regenerate", reason: "venv" },
  // OpenViking deep-memory server state: its venv and model caches rebuild.
  { test: (p) => p === ".openviking-venv" || p.startsWith(".openviking-venv/"), classification: "regenerate", reason: "venv" },
  // Caches and reproducible dependency trees.
  {
    test: (p) =>
      /(^|\/)(node_modules|__pycache__|\.pytest_cache|\.next|dist|\.turbo|\.cache|\.npm|\.local\/share\/pnpm)(\/|$)/.test(p) ||
      // Toolchain stores pruned from the air_transfer walk — each must have a
      // regenerate rule so pruning is classification-justified, never silent.
      p === ".cargo" || p.startsWith(".cargo/") ||
      p === ".rustup" || p.startsWith(".rustup/") ||
      p === ".pnpm-store" || p.startsWith(".pnpm-store/") ||
      p === ".agent-browser" || p.startsWith(".agent-browser/") ||
      p === ".vscode-server" || p.startsWith(".vscode-server/"),
    classification: "regenerate",
    reason: "reproducible",
  },
  // Provider account dotfiles.
  { test: (p) => p === ".ascii" || p.startsWith(".ascii/"), classification: "exclude", reason: "provider" },
  // Transient process state.
  {
    test: (p) => /\.(pid|sock|socket|lock)$/.test(p) || p.startsWith(".hermes/run/") || p.startsWith(".hermes/tmp/"),
    classification: "exclude",
    reason: "transient",
  },
  // Connector/MCP wiring: the file transfers (it only names the account) but
  // activation re-asserts the registration so a stale one is replaced.
  {
    test: (p) => p === ".hermes/mcp.json" || p === ".hermes/config.yaml" || p.startsWith(".hermes/connectors/"),
    classification: "reconnect",
    reason: "connector-wiring",
  },
];

/**
 * Classify one scanned entry. Any durable path no rule claims becomes
 * `transfer` — the default must move data, and "unclassified blocks
 * complete" is satisfied by the caller summing entries per class rather than
 * by a leftover bucket.
 */
export function classifyEntry(path: string, kind: string): { classification: InventoryClass; reason?: string } {
  for (const rule of RULES) {
    if (rule.test(path, kind)) {
      const out: { classification: InventoryClass; reason?: string } = {
        classification: rule.classification,
      };
      if (rule.reason !== undefined) out.reason = rule.reason;
      return out;
    }
  }
  return { classification: "transfer" };
}

export function buildManifest(
  sourceBoxId: string,
  scanned: ScannedEntry[],
  blockers: string[] = []
): MigrationManifest {
  const entries: ManifestEntry[] = scanned.map((entry) => {
    const { classification, reason } = classifyEntry(entry.path, entry.kind);
    return { ...entry, classification, ...(reason ? { reason } : {}) };
  });
  const totals = { transfer: 0, regenerate: 0, reconnect: 0, exclude: 0 };
  for (const entry of entries) totals[entry.classification] += 1;
  return {
    version: 1,
    scanned_at: new Date().toISOString(),
    source_box_id: sourceBoxId,
    entries,
    totals,
    blockers,
  };
}

/** Only these entries cross the wire. */
export function transferSet(manifest: MigrationManifest): ManifestEntry[] {
  return manifest.entries.filter((e) => e.classification === "transfer");
}
