/**
 * MC5 (goal-create-v11 §4.1, CR4, §11.7): staging never approves, the card
 * shows verbatim what the owner is approving and nothing else, approval
 * stamps the manifest the live Worker is governed by, changing egress or
 * budget re-opens the decision, and the kill switch is one-way for admins.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  approveBackend,
  BACKEND_DECISION_KIND,
  backendDecisionPayload,
  fileBackendDecision,
  loadFunctions,
  moduleAllowed,
  pendingProposal,
  resourcesFor,
  setKillSwitch,
  stageDeclaration,
} from "./backend";
import { functionsDeclarationSchema, type FunctionsDeclaration } from "./egress";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = { miniapp_functions: [], decisions: [], mini_apps: [] };
let nextId = 1;

function matches(row: Row, filters: [string, unknown][]): boolean {
  return filters.every(([k, v]) => row[k] === v);
}

function table(name: string) {
  const rows = tables[name]!;
  const filters: [string, unknown][] = [];
  let pending: { op: "select" | "update" | "insert" | "upsert"; patch?: Row; rows?: Row[] } = {
    op: "select",
  };
  const run = (): { data: unknown; error: null } => {
    switch (pending.op) {
      case "insert": {
        const inserted = pending.rows!.map((r) => ({ id: `id-${nextId++}`, status: "pending", ...r }));
        rows.push(...inserted);
        return { data: inserted, error: null };
      }
      case "upsert": {
        const out: Row[] = [];
        for (const r of pending.rows!) {
          if (!rows.some((x) => x["app_id"] === r["app_id"])) {
            const full = {
              d1_database_id: null,
              kv_namespace_id: null,
              egress: [],
              secret_names: [],
              ai_daily_cap_usd: 1,
              ai_spent_today_usd: 0,
              ai_spend_day: null,
              limits: { cpu_ms: 50, subrequests: 20 },
              status: "disabled",
              approved_manifest: null,
              deployed_at: null,
              last_error: null,
              declared: null,
              declared_at: null,
              approved_at: null,
              runtime_token_id: null,
              secret_set_at: {},
              killed_at: null,
              killed_by: null,
              ...r,
            };
            rows.push(full);
            out.push(full);
          }
        }
        return { data: out, error: null };
      }
      case "update": {
        const hit = rows.filter((r) => matches(r, filters));
        for (const r of hit) Object.assign(r, pending.patch);
        return { data: hit, error: null };
      }
      default:
        return { data: rows.filter((r) => matches(r, filters)), error: null };
    }
  };
  const builder: Row = {
    select: () => builder,
    eq: (k: string, v: unknown) => {
      filters.push([k, v]);
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    insert: (r: Row | Row[]) => {
      pending = { op: "insert", rows: Array.isArray(r) ? r : [r] };
      return builder;
    },
    upsert: (r: Row | Row[]) => {
      pending = { op: "upsert", rows: Array.isArray(r) ? r : [r] };
      return builder;
    },
    update: (patch: Row) => {
      pending = { op: "update", patch };
      return builder;
    },
    maybeSingle: async () => {
      const { data } = run();
      return { data: (data as Row[])[0] ?? null, error: null };
    },
    single: async () => {
      const { data } = run();
      return { data: (data as Row[])[0] ?? null, error: null };
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(run()).then(resolve, reject),
  };
  return builder;
}

const supabase = { from: table } as unknown as SupabaseClient;
const app = { id: "app-1", slug: "alice/rsvp", name: "RSVP", owner_user_id: "user-1" };

function declare(over: Partial<FunctionsDeclaration> = {}): FunctionsDeclaration {
  return functionsDeclarationSchema.parse({ entry: "functions/index.ts", ...over });
}

function pendingDecisions(): Row[] {
  return tables["decisions"]!.filter(
    (d) => d["kind"] === BACKEND_DECISION_KIND && d["status"] === "pending"
  );
}

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  tables["mini_apps"]!.push({ id: app.id, slug: app.slug, functions_enabled: false });
  nextId = 1;
});

describe("stageDeclaration", () => {
  it("records the declaration and moves disabled → draft, never further; approved_manifest untouched", async () => {
    const row = await stageDeclaration(supabase, app, declare({ db: true, egress: ["api.example.com"] }));
    expect(row.status).toBe("draft");
    expect(row.approved_manifest).toBeNull();
    expect(row.declared?.db).toBe(true);
    const stored = (await loadFunctions(supabase, app.id))!;
    expect(stored.status).toBe("draft");
    expect(stored.approved_manifest).toBeNull();
    expect(tables["mini_apps"]![0]!["functions_enabled"]).toBe(false);
    expect(moduleAllowed(stored, "live")).toBe(false);
    expect(moduleAllowed(stored, "draft")).toBe(true);
    expect(resourcesFor(stored, "draft")).toEqual({ db: true, kv: false });
    expect(resourcesFor(stored, "live")).toEqual({ db: false, kv: false });
  });
});

describe("fileBackendDecision", () => {
  it("files one pending miniapp_backend decision whose payload is exactly the approval surface", async () => {
    const row = await stageDeclaration(
      supabase,
      app,
      declare({ db: true, egress: ["api.example.com"], ai: { dailyCapUsd: 0.5 } })
    );
    const id = await fileBackendDecision(supabase, app, { ...row, secret_names: ["STRIPE_KEY"] });
    expect(id).toBe("id-1");
    const [decision] = pendingDecisions();
    expect(decision).toMatchObject({ user_id: "user-1", kind: BACKEND_DECISION_KIND, ref: app.slug });
    expect(decision!["payload"]).toEqual({
      egress: ["api.example.com"],
      db: true,
      kv: false,
      ai: { dailyCapUsd: 0.5 },
      secret_names: ["STRIPE_KEY"],
      previously_approved: null,
    });
    expect(JSON.stringify(decision!["payload"])).not.toContain("functions/index.ts");
    expect(decision!["label"]).toContain("api.example.com");
    expect(decision!["label"]).toContain("$0.50/day");
  });

  it("refreshes the pending decision instead of filing a second one", async () => {
    const first = await stageDeclaration(supabase, app, declare({ egress: ["a.example.com"] }));
    const id1 = await fileBackendDecision(supabase, app, first);
    const second = await stageDeclaration(supabase, app, declare({ egress: ["b.example.com"] }));
    const id2 = await fileBackendDecision(supabase, app, second);
    expect(id2).toBe(id1);
    expect(pendingDecisions()).toHaveLength(1);
    expect((pendingDecisions()[0]!["payload"] as Row)["egress"]).toEqual(["b.example.com"]);
  });

  it("files nothing when the approved manifest already matches the declaration", async () => {
    const row = await stageDeclaration(supabase, app, declare({ egress: ["a.example.com"] }));
    await approveBackend(supabase, app.id);
    const approved = (await loadFunctions(supabase, app.id))!;
    expect(pendingProposal(approved)).toBeNull();
    expect(await fileBackendDecision(supabase, app, approved)).toBeNull();
    expect(row.approved_manifest).toBeNull();
  });
});

describe("approveBackend", () => {
  it("stamps the declared egress / db / kv / cap as the approved manifest and goes live", async () => {
    await stageDeclaration(
      supabase,
      app,
      declare({ db: true, kv: true, egress: ["api.example.com"], ai: { dailyCapUsd: 2 } })
    );
    const approval = await approveBackend(supabase, app.id);
    expect(approval?.approved).toEqual({
      egress: ["api.example.com"],
      db: true,
      kv: true,
      dailyCapUsd: 2,
      secretNames: [],
    });
    const row = (await loadFunctions(supabase, app.id))!;
    expect(row.status).toBe("live");
    expect(row.egress).toEqual(["api.example.com"]);
    expect(row.ai_daily_cap_usd).toBe(2);
    expect(row.approved_at).not.toBeNull();
    expect(tables["mini_apps"]![0]!["functions_enabled"]).toBe(true);
    expect(moduleAllowed(row, "live")).toBe(true);
    expect(resourcesFor(row, "live")).toEqual({ db: true, kv: true });
  });

  it("re-opens the decision when egress or the cap changes after approval, with the prior approval on the card", async () => {
    await stageDeclaration(supabase, app, declare({ egress: ["a.example.com"] }));
    await approveBackend(supabase, app.id);
    const widened = await stageDeclaration(
      supabase,
      app,
      declare({ egress: ["a.example.com", "b.example.com"], ai: { dailyCapUsd: 3 } })
    );
    // The live manifest is still the approved one until the owner acts.
    expect(widened.approved_manifest?.egress).toEqual(["a.example.com"]);
    expect(widened.status).toBe("live");
    const id = await fileBackendDecision(supabase, app, widened);
    expect(id).not.toBeNull();
    const payload = pendingDecisions()[0]!["payload"] as Row;
    expect(payload["egress"]).toEqual(["a.example.com", "b.example.com"]);
    expect(payload["previously_approved"]).toEqual({
      egress: ["a.example.com"],
      db: false,
      kv: false,
      ai: { dailyCapUsd: 1 },
      secret_names: [],
    });
    const stored = (await loadFunctions(supabase, app.id))!;
    expect(stored.egress).toEqual(["a.example.com"]);
    expect(stored.ai_daily_cap_usd).toBe(1);
  });

  it("returns null with nothing declared", async () => {
    expect(await approveBackend(supabase, app.id)).toBeNull();
  });

  it("does not grant a killed app a live module", async () => {
    await stageDeclaration(supabase, app, declare());
    await setKillSwitch(supabase, app.id, true, "admin");
    const approval = await approveBackend(supabase, app.id);
    expect(approval?.row.status).toBe("suspended");
    expect(moduleAllowed((await loadFunctions(supabase, app.id))!, "live")).toBe(false);
  });
});

describe("setKillSwitch", () => {
  it("kills for owner or admin, restores only for the owner, and never widens", async () => {
    await stageDeclaration(supabase, app, declare({ egress: ["a.example.com"] }));
    await approveBackend(supabase, app.id);
    const killed = await setKillSwitch(supabase, app.id, true, "admin");
    expect(killed?.status).toBe("suspended");
    expect(killed?.killed_by).toBe("admin");
    expect(moduleAllowed(killed, "live")).toBe(false);
    expect(moduleAllowed(killed, "draft")).toBe(false);
    expect(tables["mini_apps"]![0]!["functions_enabled"]).toBe(false);
    await expect(setKillSwitch(supabase, app.id, false, "admin")).rejects.toThrow(/owner/);
    const restored = await setKillSwitch(supabase, app.id, false, "owner");
    expect(restored?.status).toBe("live");
    expect(restored?.approved_manifest?.egress).toEqual(["a.example.com"]);
    expect(tables["mini_apps"]![0]!["functions_enabled"]).toBe(true);
  });

  it("restoring an app that was never approved lands on draft, not live", async () => {
    await stageDeclaration(supabase, app, declare());
    await setKillSwitch(supabase, app.id, true, "owner");
    const restored = await setKillSwitch(supabase, app.id, false, "owner");
    expect(restored?.status).toBe("draft");
    expect(tables["mini_apps"]![0]!["functions_enabled"]).toBe(false);
  });
});

describe("backendDecisionPayload", () => {
  it("is content-free: hosts, flags, a dollar figure, secret names", () => {
    const payload = backendDecisionPayload(
      { egress: ["x.example.com"], db: false, kv: true, dailyCapUsd: 1, secretNames: ["API_KEY"] },
      null
    );
    expect(Object.keys(payload).sort()).toEqual(
      ["ai", "db", "egress", "kv", "previously_approved", "secret_names"].sort()
    );
  });
});
