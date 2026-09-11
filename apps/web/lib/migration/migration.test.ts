/**
 * Migration correctness tests (plan §10): admission gating, exclusion,
 * inventory classification, CAS discipline on the durable state machine,
 * and the sealed-credential round trip. RPC behavior is emulated against the
 * same contract the real functions implement in 0106_compute_migrations.sql.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { classifyEntry, buildManifest, transferSet } from "./inventory";
import {
  assertAdmissionOpen,
  admitOperation,
  migrationBusyResponse,
  OP_TTL_SECONDS,
} from "./admission";
import { MigrationBusyError } from "./types";
import { activeMigrationFor } from "./exclusion";
import {
  activeTarget,
  copySides,
  retainedTarget,
  transition,
} from "./store";
import { openCredentials, routePayload, sealCredentials } from "./credentials";
import { AIR_TRANSFER_SCRIPT_B64, AIR_TRANSFER_SCRIPT_SHA256 } from "./airTransferScript";
import type { ComputeMigration, MigrationTarget, TargetRole } from "./types";
import type { TargetCredentials } from "./credentials";

// ─── supabase stubs ─────────────────────────────────────────────────────────

interface StubOptions {
  admission?: "open" | "closed";
  rpcErrors?: Record<string, { code: string; message: string }>;
  tables?: Record<string, unknown>;
}

/**
 * An rpc()-only stub: each name maps to a function over in-memory state that
 * mirrors the SQL contract (admission_open returns boolean; admit_operation
 * returns admitted+ids; transition-shaped CAS is exercised separately).
 */
function stubSupabase(opts: StubOptions = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const ops: Array<Record<string, unknown>> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const failure = opts.rpcErrors?.[name];
      if (failure) return { data: null, error: failure };
      if (name === "admission_open") {
        return { data: opts.admission !== "closed", error: null };
      }
      if (name === "admit_operation") {
        if (opts.admission === "closed") {
          return { data: { admitted: false }, error: null };
        }
        const op = { id: `op-${ops.length}`, ...args };
        ops.push(op);
        return {
          data: { admitted: true, operation_id: op.id, routing_generation: 7 },
          error: null,
        };
      }
      if (name === "complete_operation") {
        return { data: { completed: true }, error: null };
      }
      return { data: null, error: { code: "PGRST202", message: "unknown rpc" } };
    },
    from: (table: string) => {
      const rows = (opts.tables?.[table] ?? []) as Record<string, unknown>[];
      const filters: Array<{ col: string; op: string; val: unknown }> = [];
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push({ col, op: "eq", val });
          return builder;
        },
        in: (col: string, val: unknown) => {
          filters.push({ col, op: "in", val });
          return builder;
        },
        not: (col: string, op: string, val: unknown) => {
          filters.push({ col, op: `not.${op}`, val });
          return builder;
        },
        is: (col: string, val: unknown) => {
          filters.push({ col, op: "is", val });
          return builder;
        },
        limit: () => builder,
        maybeSingle: async () => {
          const match = rows.filter((r) =>
            filters.every((f) => {
              if (f.op === "eq") return r[f.col] === f.val;
              if (f.op === "not.in")
                return !(f.val as string[]).includes(r[f.col] as string);
              return true;
            })
          );
          return { data: match[0] ?? null, error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, calls, ops };
}

// ─── admission ───────────────────────────────────────────────────────────────

describe("admission", () => {
  it("admitOperation returns a lease while admission is open", async () => {
    const { client, ops } = stubSupabase({ admission: "open" });
    const op = await admitOperation(client, "u1", "turn", "turn:x");
    expect(op.operationId).toBe("op-0");
    expect(op.routingGeneration).toBe(7);
    expect(ops[0]?.["p_kind"]).toBe("turn");
    expect(ops[0]?.["p_ttl_seconds"]).toBe(OP_TTL_SECONDS.turn);
  });

  it("admitOperation throws MigrationBusyError under a pause", async () => {
    const { client } = stubSupabase({ admission: "closed" });
    await expect(
      admitOperation(client, "u1", "turn", "turn:x")
    ).rejects.toBeInstanceOf(MigrationBusyError);
  });

  it("assertAdmissionOpen throws only on an explicit close", async () => {
    const open = stubSupabase({ admission: "open" });
    await expect(
      assertAdmissionOpen(open.client, "u1")
    ).resolves.toBeUndefined();
    const closed = stubSupabase({ admission: "closed" });
    await expect(
      assertAdmissionOpen(closed.client, "u1")
    ).rejects.toBeInstanceOf(MigrationBusyError);
  });

  it("assertAdmissionOpen fails open when the RPC is missing (pre-deploy)", async () => {
    const { client } = stubSupabase({
      rpcErrors: {
        admission_open: { code: "PGRST202", message: "function not found" },
      },
    });
    await expect(
      assertAdmissionOpen(client, "u1")
    ).resolves.toBeUndefined();
  });

  it("migrationBusyResponse maps only MigrationBusyError to 503+Retry-After", () => {
    const busy = migrationBusyResponse(new MigrationBusyError());
    expect(busy?.status).toBe(503);
    expect(busy?.headers.get("Retry-After")).toBe("30");
    expect(migrationBusyResponse(new Error("x"))).toBeNull();
  });
});

// ─── exclusion ───────────────────────────────────────────────────────────────

describe("exclusion", () => {
  it("reports a live migration for the user", async () => {
    const { client } = stubSupabase({
      tables: {
        compute_migrations: [
          { id: "mig-1", user_id: "u1", phase: "observing" },
          { id: "mig-old", user_id: "u1", phase: "completed" },
        ],
      },
    });
    // .not("phase","in",...) filter emulation: our stub handles not.in.
    const live = await activeMigrationFor(client, "u1");
    expect(live?.id).toBe("mig-1");
  });

  it("returns null when only terminal migrations exist", async () => {
    const { client } = stubSupabase({
      tables: {
        compute_migrations: [{ id: "mig-old", user_id: "u1", phase: "completed" }],
      },
    });
    expect(await activeMigrationFor(client, "u1")).toBeNull();
  });
});

// ─── inventory classification ────────────────────────────────────────────────

describe("inventory classification", () => {
  it("classifies the plan's categories", () => {
    expect(classifyEntry(".air/fence.json", "file").classification).toBe("exclude");
    expect(classifyEntry(".hermes/vault/store.enc", "file").classification).toBe("exclude");
    expect(classifyEntry(".hermes/.env", "file").classification).toBe("regenerate");
    expect(classifyEntry("hermes-agent/pkg/x.py", "file").classification).toBe("regenerate");
    expect(classifyEntry(".hermes-venv/lib/x.so", "file").classification).toBe("regenerate");
    expect(classifyEntry(".ascii/creds", "file").classification).toBe("exclude");
    expect(classifyEntry(".hermes/run/pid.lock", "file").classification).toBe("exclude");
    expect(classifyEntry(".hermes/mcp.json", "file").classification).toBe("reconnect");
    expect(classifyEntry(".hermes/state/hermes_state.db", "sqlite").classification).toBe("transfer");
    expect(classifyEntry("work/report.md", "file").classification).toBe("transfer");
    // No blanket .git exclusion: user repos transfer.
    expect(classifyEntry("work/repo/.git/objects/aa", "file").classification).toBe("transfer");
  });

  it("buildManifest totals every class and transferSet filters", () => {
    const manifest = buildManifest("bx_1", [
      { path: "notes.md", kind: "file", bytes: 5, sha256: "x", mtime: 0 },
      { path: ".hermes/.env", kind: "file", bytes: 1, sha256: "y", mtime: 0 },
      { path: ".air/fence.json", kind: "file", bytes: 1, sha256: "z", mtime: 0 },
      { path: ".hermes/mcp.json", kind: "file", bytes: 1, sha256: "w", mtime: 0 },
    ]);
    expect(manifest.totals).toEqual({
      transfer: 1,
      regenerate: 1,
      reconnect: 1,
      exclude: 1,
    });
    expect(transferSet(manifest).map((e) => e.path)).toEqual(["notes.md"]);
  });
});

// ─── credential envelope ─────────────────────────────────────────────────────

describe("credential envelope", () => {
  const CREDS: TargetCredentials = {
    provider: "tenki",
    provider_box_id: "tk_1",
    environment: "ubuntu",
    hosted_url: "https://x",
    hosted_token: "t",
    dashboard_url: "https://d",
    dashboard_token: "dt",
    dashboard_auth: "sealed-auth",
    api_server_key: "ask",
    gateway_token: "gt",
    template_version: "v1",
    channel: "stable",
    baseline_version: "2026.01.01",
    baseline_synced_at: "2026-01-01T00:00:00Z",
    provider_name: "tenki",
    control_url: "https://c",
    control_token: "ct",
    state: "ready",
  };

  it("round-trips through seal/open (BOX_DASHBOARD_AUTH_KEY fallback)", () => {
    process.env["BOX_DASHBOARD_AUTH_KEY"] ??= "a".repeat(64);
    const sealed = sealCredentials(CREDS);
    expect(sealed).not.toContain("tk_1");
    expect(openCredentials(sealed)).toEqual(CREDS);
  });

  it("never carries a vault key — the envelope type has no field for it", () => {
    const route = routePayload(CREDS);
    // The boxes-row payload is routing state only (I2): no vault field.
    expect("AIR_VAULT_KEY" in route).toBe(false);
    expect(route["provider_box_id"]).toBe("tk_1");
  });
});

// ─── store: role sides + CAS discipline ──────────────────────────────────────

function makeTarget(role: string, boxId: string): MigrationTarget {
  return {
    migration_id: "mig-1",
    role: role as TargetRole as never,
    provider: "ascii",
    provider_box_id: boxId,
    hosted_url: null,
    credentials_sealed: null,
    manifest: null,
    integrity: null,
    created_at: "t",
    updated_at: "t",
  };
}

function makeMigration(over: Partial<ComputeMigration> = {}): ComputeMigration {
  return {
    id: "mig-1",
    user_id: "u1",
    direction: "box_to_tenki",
    phase: "precopy",
    leg: "out",
    request_key: null,
    source_provider: "ascii",
    target_provider: "tenki",
    source_box_id: "bx_1",
    candidate_box_id: "tk_1",
    expected_generation: 1,
    worker_token: "w1",
    worker_lease_until: null,
    wake_at: null,
    steps: {},
    manifest: null,
    stats: null,
    verification: null,
    options: {},
    error_code: null,
    error_detail: null,
    cancel_requested_at: null,
    cleanup_approved_at: null,
    work_paused_at: null,
    work_resumed_at: null,
    route_committed_at: null,
    activated_at: null,
    retention_until: null,
    completed_at: null,
    created_at: "t",
    updated_at: "t",
    ...over,
  };
}

describe("target role sides", () => {
  const targets = [
    makeTarget("source", "bx_1"),
    makeTarget("candidate", "tk_1"),
  ];

  it("out leg copies source→candidate", () => {
    const { from, to } = copySides(makeMigration(), targets);
    expect(from.provider_box_id).toBe("bx_1");
    expect(to.provider_box_id).toBe("tk_1");
  });

  it("back leg copies active→retained (roles after commit)", () => {
    const postCommit = [
      makeTarget("retained", "bx_1"),
      makeTarget("active", "tk_1"),
    ];
    const { from, to } = copySides(makeMigration({ leg: "back" }), postCommit);
    expect(from.provider_box_id).toBe("tk_1");
    expect(to.provider_box_id).toBe("bx_1");
    expect(retainedTarget(postCommit)?.provider_box_id).toBe("bx_1");
    expect(activeTarget(postCommit)?.provider_box_id).toBe("tk_1");
  });
});

describe("transition CAS", () => {
  it("writes only while worker token + phase still match", async () => {
    // Emulate the row: phase precopy, worker w1.
    const row = { id: "mig-1", phase: "precopy", worker_token: "w1", steps: {} };
    const client = {
      from: (table: string) => {
        expect(table).toBe("compute_migrations");
        let update: Record<string, unknown> = {};
        const filters: Record<string, unknown> = {};
        const builder: Record<string, unknown> = {
          update: (u: Record<string, unknown>) => {
            update = u;
            return builder;
          },
          eq: (c: string, v: unknown) => {
            filters[c] = v;
            return builder;
          },
          in: (c: string, v: string[]) => {
            filters[c] = { in: v };
            return builder;
          },
          select: async () => {
            const phaseFilter = filters["phase"] as { in: string[] };
            const match =
              filters["id"] === row.id &&
              filters["worker_token"] === row.worker_token &&
              phaseFilter.in.includes(row.phase);
            if (!match) return { data: [] };
            return { data: [{ ...row, ...update }] };
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;

    const migration = makeMigration();
    const moved = await transition(client, migration, "w1", ["precopy"], {
      phase: "final_copy",
    });
    expect(moved.phase).toBe("final_copy");

    // Wrong worker loses the CAS.
    await expect(
      transition(client, migration, "other-worker", ["precopy"], { phase: "final_copy" })
    ).rejects.toThrow(/moved off|lease lost/);

    // Wrong phase loses the CAS.
    await expect(
      transition(client, migration, "w1", ["observing"], { phase: "cleanup_pending" })
    ).rejects.toThrow(/moved off|lease lost/);
  });
});

// ─── embedded transfer tool regression ───────────────────────────────────────

describe("air transfer script", () => {
  it("embeds infra/template/airtransfer/air_transfer.py byte-exactly", () => {
    const scriptPath = path.resolve(
      __dirname,
      "../../../../infra/template/airtransfer/air_transfer.py"
    );
    const onDisk = readFileSync(scriptPath);
    const decoded = Buffer.from(AIR_TRANSFER_SCRIPT_B64, "base64");
    expect(decoded.equals(onDisk)).toBe(true);
    const sha = execFileSync("sha256sum", [scriptPath])
      .toString()
      .split(" ")[0];
    expect(AIR_TRANSFER_SCRIPT_SHA256).toBe(sha);
  });

  it("encrypts with AES-256-GCM framing (AIRX1 magic + chunked AAD)", () => {
    const script = Buffer.from(AIR_TRANSFER_SCRIPT_B64, "base64").toString();
    expect(script).toContain('MAGIC = b"AIRX1\\n"');
    expect(script).toContain("AESGCM");
    expect(script).toContain("conn.backup(");
  });
});
