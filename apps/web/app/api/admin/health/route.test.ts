import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, string>,
  selects: [] as Array<{ table: string; columns: string }>,
}));

const memory = vi.hoisted(() => ({
  deepMemoryStatus: vi.fn(),
  peekBoxState: vi.fn(),
  ensureBoxAwake: vi.fn(),
  armStopAfter: vi.fn(),
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    let values = db.rows[table] ?? [];
    let single = false;
    let countRequested = false;
    const chain: Record<string, unknown> = {};
    chain["select"] = vi.fn(
      (columns = "*", options?: { count?: string }) => {
      db.selects.push({ table, columns });
      countRequested = options?.count === "exact";
      return chain;
      },
    );
    chain["eq"] = vi.fn((column: string, value: unknown) => {
      values = values.filter((entry) => entry[column] === value);
      return chain;
    });
    chain["gte"] = vi.fn(() => chain);
    chain["order"] = vi.fn(() => chain);
    chain["limit"] = vi.fn(() => chain);
    chain["maybeSingle"] = vi.fn(() => {
      single = true;
      return chain;
    });
    chain["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: single ? (values[0] ?? null) : values,
        error: db.errors[table]
          ? { message: db.errors[table] }
          : null,
        count: countRequested ? values.length : null,
      }).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

vi.mock("@/lib/memory/deep", () => ({
  deepMemoryStatus: memory.deepMemoryStatus,
}));

vi.mock("@/lib/orchestrator/boxes", () => ({
  StartLimitError: class StartLimitError extends Error {},
  peekBoxState: memory.peekBoxState,
  ensureBoxAwake: memory.ensureBoxAwake,
  armStopAfter: memory.armStopAfter,
}));

vi.mock("@/lib/provisioning/provision", () => ({
  REPLACE_CLAIM_TTL_MS: 60_000,
}));

import { GET } from "./route";

const userId = "11111111-1111-4111-8111-111111111111";
const base = `https://air.test/api/admin/health?user_id=${userId}`;
const authed = (url = base) =>
  new NextRequest(url, {
    headers: { authorization: "Bearer admin-key" },
  });

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.rows = {};
  db.errors = {};
  db.selects = [];
  vi.clearAllMocks();
  memory.armStopAfter.mockResolvedValue(undefined);
});

describe("GET /api/admin/health", () => {
  it("requires admin authorization and a valid window", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
    expect((await GET(authed(`${base}&days=0`))).status).toBe(400);
    expect((await GET(authed(`${base}&wake=1`))).status).toBe(400);
  });

  it("returns a metadata-only per-user health snapshot", async () => {
    const now = Date.now();
    const oldClaim = new Date(now - 120_000).toISOString();
    db.rows = {
      boxes: [
        {
          user_id: userId,
          provider: "ascii",
          provider_box_id: "bx_one",
          environment: "ubuntu",
          state: "ready",
          channel: "prod",
          template_version: "hermes-2",
          baseline_version: "2026.09.09-abcd123",
          baseline_synced_at: "2026-09-09T20:00:00Z",
          last_active_at: "2026-09-09T20:05:00Z",
          replace_claimed_at: oldClaim,
        },
      ],
      agent_runs: [
        {
          user_id: userId,
          started_at: "2026-09-09T20:00:00Z",
          ended_at: "2026-09-09T20:00:10Z",
          outcome: "completed",
          latency_ms: 100,
          prompt_tokens: 10,
          completion_tokens: 20,
          cost_usd: 0.01,
        },
        {
          user_id: userId,
          started_at: "2026-09-09T19:00:00Z",
          ended_at: "2026-09-09T19:00:05Z",
          outcome: "failed",
          latency_ms: 500,
          prompt_tokens: 5,
          completion_tokens: 0,
          cost_usd: 0.002,
        },
        {
          user_id: userId,
          started_at: "2026-09-09T18:30:00Z",
          ended_at: "2026-09-09T18:30:01Z",
          outcome: "gateway_completion",
          latency_ms: 900,
          prompt_tokens: 7,
          completion_tokens: 8,
          cost_usd: 0.003,
        },
      ],
      inbound_events: [
        {
          user_id: userId,
          received_at: "2026-09-09T20:10:00Z",
          status: "received",
        },
        {
          user_id: userId,
          received_at: "2026-09-09T20:09:00Z",
          status: "failed",
        },
      ],
      batch_queue: [
        {
          user_id: userId,
          received_at: "2026-09-09T20:08:00Z",
        },
      ],
      connections: [
        {
          user_id: userId,
          provider: "composio",
          toolkit: "gmail",
          status: "active",
          connected_at: "2026-09-01T00:00:00Z",
          external_account_id: "must-not-leave-control-plane",
        },
      ],
      box_state_events: [
        { user_id: userId, state: "ready", created_at: "2026-09-09T18:00:00Z" },
        {
          user_id: userId,
          state: "keepawake",
          created_at: "2026-09-09T17:30:00Z",
        },
        {
          user_id: userId,
          state: "stopped",
          created_at: "2026-09-09T17:00:00Z",
        },
      ],
      entitlements: [
        {
          user_id: userId,
          speed_tier: "balanced",
          spend_mtd_usd: 3,
          monthly_cap_usd: 10,
        },
      ],
      cost_events: [{ user_id: userId, kind: "render", amount_cents: 20 }],
      creative_assets: [{ user_id: userId, bytes: 1_073_741_824 }],
      spend_reports: [{ user_id: userId, spend_cents: 30 }],
      ad_settings: [{ user_id: userId, spend_ceiling_cents: 100 }],
      cortex_calls: [
        { user_id: userId, ok: true },
        { user_id: userId, ok: false },
      ],
      box_channels: [
        {
          name: "prod",
          release_id: "release-1",
          updated_at: "2026-09-09T16:00:00Z",
        },
      ],
      template_releases: [
        {
          id: "release-1",
          version: "2026.09.09-abcd123",
          hermes_ref: "hermes-2",
        },
      ],
    };

    const response = await GET(authed());
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.memory.status).toBe("not_checked");
    expect(body.hermes).toMatchObject({
      runs: 2,
      success: 1,
      failed: 1,
      p95_latency_ms: 500,
      failure_outcomes: { failed: 1 },
    });
    expect(body.connectors).toEqual({
      total: 1,
      counts: { active: 1 },
      connections: [
        {
          provider: "composio",
          toolkit: "gmail",
          status: "active",
          connected_at: "2026-09-01T00:00:00Z",
        },
      ],
    });
    expect(body.transport).toMatchObject({
      total: 2,
      failed: 1,
      queued: 1,
    });
    expect(body.compute).toMatchObject({
      provider: "ascii",
      provider_box_id: "bx_one",
      drift: "current",
      starts: 1,
      stops: 1,
      replacement_claim_status: "stale",
    });
    expect(body.spend).toMatchObject({
      total_tokens: 15,
      gateway_cost_usd: 0.003,
      monthly_cap_ratio: 0.3,
      render_cents: 20,
      storage_bytes: 1_073_741_824,
      storage_cents_month: 3,
      ad_spend_cents: 30,
      ad_ceiling_cents: 100,
      cortex_calls: 2,
      cortex_errors: 1,
    });
    expect(memory.peekBoxState).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("must-not-leave-control-plane");
    const selected = db.selects.map((entry) => entry.columns).join(",");
    expect(selected).not.toMatch(
      /message_body|prompt_text|document|content|external_account_id|hosted_url/
    );
  });

  it("derives queued work from batch_queue, not inbound receipts", async () => {
    db.rows = {
      inbound_events: [
        {
          user_id: userId,
          received_at: "2026-09-09T20:10:00Z",
          status: "received",
        },
      ],
    };

    const body = await (await GET(authed())).json();
    expect(body.transport).toMatchObject({
      received: 1,
      queued: 0,
      oldest_queued_at: null,
    });
  });

  it("returns unavailable when a required health query fails", async () => {
    db.errors["agent_runs"] = "database offline";

    const response = await GET(authed());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "health data unavailable",
      sources: ["agent_runs"],
    });
  });

  it.each(["box_channels", "template_releases"])(
    "returns unavailable when %s cannot be read",
    async (table) => {
      db.rows = {
        boxes: [{ user_id: userId, channel: "prod" }],
        box_channels: [
          { name: "prod", release_id: "release-1" },
        ],
      };
      db.errors[table] = "database offline";

      const response = await GET(authed());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "health data unavailable",
        sources: [table],
      });
    }
  );

  it("checks memory without waking an asleep box", async () => {
    db.rows = {
      boxes: [{ user_id: userId, provider_box_id: "bx_one", state: "stopped" }],
    };
    memory.peekBoxState.mockResolvedValue({
      awake: false,
      boxId: "bx_one",
    });
    const body = await (
      await GET(authed(`${base}&memory=1`))
    ).json();
    expect(body.memory.status).toBe("asleep");
    expect(memory.ensureBoxAwake).not.toHaveBeenCalled();
    expect(memory.deepMemoryStatus).not.toHaveBeenCalled();
  });

  it("wakes and checks memory only when explicitly requested", async () => {
    db.rows = {
      boxes: [{ user_id: userId, provider_box_id: "bx_one", state: "stopped" }],
    };
    memory.peekBoxState.mockResolvedValue({
      awake: false,
      boxId: "bx_one",
    });
    memory.ensureBoxAwake.mockResolvedValue({ boxId: "bx_one" });
    memory.deepMemoryStatus.mockResolvedValue({
      healthy: true,
      resources: 4,
      memories: 12,
      workspace_bytes: 100,
      pending: 1,
      truncated: false,
    });
    const body = await (
      await GET(authed(`${base}&memory=1&wake=1`))
    ).json();
    expect(body.memory).toMatchObject({
      status: "healthy",
      woke: true,
      resources: 4,
      memories: 12,
      pending: 1,
    });
    expect(memory.ensureBoxAwake).toHaveBeenCalledWith(
      expect.anything(),
      userId
    );
    expect(memory.armStopAfter).toHaveBeenCalled();
  });
});
