/**
 * Admin Create funnel contract (V12 §12): bearer auth, window validation,
 * the CreateOpsResponse shape with every field present, aggregation from
 * create_intakes / create_builds / miniapp_versions / ops_events, and
 * unapplied tables reading as zeros rather than a 500.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AdminFakeDb } from "@/lib/admin/testing/fakeDb";
import { INTAKE_STAGES } from "@/lib/create/intake";

const db = vi.hoisted(() => ({ fake: null as unknown as { client(): unknown } }));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.fake.client() }));

import { GET } from "./route";

const base = "https://air.test/api/admin/create";
const authed = (qs = "") =>
  new NextRequest(`${base}${qs}`, { headers: { authorization: "Bearer admin-key", "x-admin-operator": "carol" } });
const recent = new Date(Date.now() - 3_600_000).toISOString();
const old = new Date(Date.now() - 400 * 86_400_000).toISOString();

let fake: AdminFakeDb;

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  fake = new AdminFakeDb();
  db.fake = fake;
});

describe("GET /api/admin/create", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("400s on a bad window", async () => {
    expect((await GET(authed("?days=0"))).status).toBe(400);
    expect((await GET(authed("?days=400"))).status).toBe(400);
  });

  it("answers the full CreateOpsResponse shape on an empty database", async () => {
    const response = await GET(authed("?days=7"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      window_days: 7,
      funnel: Object.fromEntries(INTAKE_STAGES.map((stage) => [stage, 0])),
      medians_s: { first_question: null, plan: null, confirm_to_dev: null, dev_to_prod: null },
      builds: { total: 0, failed: 0, by_rule: {} },
      qa: { p50: null, p90: null, below_70: 0 },
      tests: { declared: 0, passed_ratio: null },
      progress_relay: { cards_updated: 0, text_fallbacks: 0, update_failures: 0 },
      mirror: { ok: 0, failed: 0 },
      budget_exhausted: 0,
      by_template: {},
    });
  });

  it("aggregates intakes, builds, versions and budget hits inside the window", async () => {
    fake.tables["create_intakes"] = [
      {
        stage: "production",
        template: "landing",
        opened_at: "2026-09-01T00:00:00.000Z",
        confirmed_at: "2026-09-01T00:10:00.000Z",
        dev_ready_at: "2026-09-01T00:20:00.000Z",
        production_at: "2026-09-01T01:20:00.000Z",
        mirror_error: null,
        updated_at: recent,
      },
      {
        stage: "building",
        template: "tool",
        opened_at: "2026-09-01T00:00:00.000Z",
        confirmed_at: "2026-09-01T00:30:00.000Z",
        dev_ready_at: null,
        production_at: null,
        mirror_error: "push failed",
        updated_at: recent,
      },
      { stage: "abandoned", template: "landing", opened_at: old, updated_at: old },
    ];
    fake.tables["create_builds"] = [
      { status: "succeeded", findings: [], started_at: recent },
      {
        status: "failed",
        findings: [{ file: "index.html", rule: "csp.host-reference", hint: "", severity: "hard" }],
        started_at: recent,
      },
      { status: "failed", findings: [], started_at: old },
    ];
    fake.tables["miniapp_versions"] = [
      { qa_score: 90, tests_total: 4, tests_passed: 4, mirrored_at: recent, created_at: recent },
      { qa_score: 60, tests_total: 2, tests_passed: 1, mirrored_at: null, created_at: recent },
      { qa_score: 10, tests_total: null, tests_passed: null, mirrored_at: null, created_at: old },
    ];
    fake.tables["ops_events"] = [
      { kind: "rate_limited", ref: "create_budget", created_at: recent },
      { kind: "rate_limited", ref: "launch", created_at: recent },
      { kind: "launch", ref: "create_budget", created_at: recent },
    ];
    const body = await (await GET(authed("?days=30"))).json();
    expect(body.funnel).toMatchObject({ production: 1, building: 1, abandoned: 0 });
    expect(body.medians_s).toEqual({
      first_question: null,
      plan: 1200,
      confirm_to_dev: 600,
      dev_to_prod: 3600,
    });
    expect(body.builds).toEqual({
      total: 2,
      failed: 1,
      by_rule: { "csp.host-reference": 1 },
    });
    expect(body.qa).toEqual({ p50: 75, p90: 87, below_70: 1 });
    expect(body.tests).toEqual({ declared: 2, passed_ratio: 0.833 });
    expect(body.mirror).toEqual({ ok: 1, failed: 1 });
    expect(body.budget_exhausted).toBe(1);
    expect(body.by_template).toEqual({ landing: 1, tool: 1 });
    expect(fake.filters).toContainEqual({
      table: "ops_events",
      op: "eq",
      column: "ref",
      value: "create_budget",
    });
  });

  it("reads an unapplied table as zeros rather than failing", async () => {
    fake.errors["create_intakes"] = { message: "relation does not exist" };
    fake.tables["create_builds"] = [{ status: "succeeded", findings: [], started_at: recent }];
    const response = await GET(authed());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.funnel.asking).toBe(0);
    expect(body.builds.total).toBe(1);
  });
});
