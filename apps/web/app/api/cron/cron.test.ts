/**
 * R-TQ-07: one shared authorization test for every Vercel cron route.
 * Each route's handler is driven through three cases — no CRON_SECRET,
 * wrong secret, right secret — and the right-secret case asserts the
 * route's sweep entry ran exactly once.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  ingestOpenAiMetrics: vi.fn(async () => ({ ingested: 0 })),
  enqueueMetaReporting: vi.fn(async () => ({ enqueued: 0 })),
  sweepSpendCeilings: vi.fn(async () => ({ paused: 0 })),
  probeConnectionHealth: vi.fn(async () => ({ probed: 0 })),
  reconcileSpend: vi.fn(async () => ({ reconciled: 0 })),
  creativePreflight: vi.fn(async () => ({ checked: 0 })),
  publishDueSlots: vi.fn(async () => ({ published: 0 })),
  sweepSchedules: vi.fn(async () => ({ fired: 0 })),
  candidateUsers: vi.fn(async () => [] as string[]),
  proposeForUser: vi.fn(async () => ({ momentsProposed: 0, slotsProposed: 0 })),
  claimFlush: vi.fn(async () => null),
  runFlush: vi.fn(async () => undefined),
  recoverOrphanedCarriedJobs: vi.fn(async () => ({ restored: 0, unresolved: 0 })),
  listClaimableOverdueFlushJobs: vi.fn(async () => [] as unknown[]),
  findSweepableBoxes: vi.fn(async () => [] as unknown[]),
  stopIdleBoxes: vi.fn(async () => ({ stopped: 0, indexingDeferred: 0 })),
  reconcileVerdict: vi.fn(async () => "pending" as const),
  sweepAbandonedUploads: vi.fn(async () => 0),
  runSyncJobs: vi.fn(async () => ({ synced: 0, failed: 0, deferred: 0 })),
  sweepUnfiledDrafts: vi.fn(async () => 0),
  sweepVersions: vi.fn(async () => 0),
  reconcileAppOriginMarks: vi.fn(async () => ({ marked: 0 })),
  reconcileAppOrigins: vi.fn(async () => ({ repaired: 0 })),
  reconcileMigrations: vi.fn(async () => ({ driven: 0 })),
  resolveDueLocationRequests: vi.fn(async () => ({ resolved: 0, expired: 0 })),
  expireTradeApprovals: vi.fn(async () => 0),
  reconcileTradeOrders: vi.fn(async () => 0),
  tickWatchlists: vi.fn(async () => 0),
}));

vi.mock("@/lib/supabase", () => {
  const chain = (() => {
    const self: Record<string, unknown> = {};
    for (const method of [
      "select",
      "insert",
      "update",
      "delete",
      "eq",
      "is",
      "in",
      "gt",
      "gte",
      "lt",
      "lte",
      "not",
      "order",
      "limit",
      "single",
      "maybeSingle",
    ]) {
      self[method] = () => self;
    }
    self["then"] = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    self["single"] = async () => ({ data: null, error: null });
    self["maybeSingle"] = async () => ({ data: null, error: null });
    return self;
  })();
  return { serviceClient: () => ({ from: () => chain }) };
});
vi.mock("@/lib/ads/metrics", () => ({
  ingestOpenAiMetrics: mocks.ingestOpenAiMetrics,
  enqueueMetaReporting: mocks.enqueueMetaReporting,
}));
vi.mock("@/lib/ads/sweep", () => ({ sweepSpendCeilings: mocks.sweepSpendCeilings }));
vi.mock("@/lib/publish/health", () => ({ probeConnectionHealth: mocks.probeConnectionHealth }));
vi.mock("@/lib/ads/reconcile", () => ({ reconcileSpend: mocks.reconcileSpend }));
vi.mock("@/lib/creative/preflight", () => ({ creativePreflight: mocks.creativePreflight }));
vi.mock("@/lib/publish/worker", () => ({ publishDueSlots: mocks.publishDueSlots }));
vi.mock("@/lib/calendar/sweep", () => ({ sweepSchedules: mocks.sweepSchedules }));
vi.mock("@/lib/publish/propose", () => ({
  candidateUsers: mocks.candidateUsers,
  proposeForUser: mocks.proposeForUser,
}));
vi.mock("@/lib/orchestrator/flush", () => ({
  claimFlush: mocks.claimFlush,
  runFlush: mocks.runFlush,
}));
vi.mock("@/lib/orchestrator/carryRecovery", () => ({
  recoverOrphanedCarriedJobs: mocks.recoverOrphanedCarriedJobs,
}));
vi.mock("@/lib/orchestrator/overdueFlush", () => ({
  listClaimableOverdueFlushJobs: mocks.listClaimableOverdueFlushJobs,
}));
vi.mock("@/lib/orchestrator/sweep", () => ({
  findSweepableBoxes: mocks.findSweepableBoxes,
}));
vi.mock("@/lib/orchestrator/idleStop", () => ({
  stopIdleBoxes: mocks.stopIdleBoxes,
}));
vi.mock("@/lib/orchestrator/reconcile", () => ({
  reconcileVerdict: mocks.reconcileVerdict,
}));
vi.mock("@/lib/storage/confirm", () => ({
  sweepAbandonedUploads: mocks.sweepAbandonedUploads,
}));
vi.mock("@/lib/fleet/sync", () => ({ runSyncJobs: mocks.runSyncJobs }));
vi.mock("@/lib/email/draftSweep", () => ({
  sweepUnfiledDrafts: mocks.sweepUnfiledDrafts,
}));
vi.mock("@/lib/create/versions", () => ({ sweepVersions: mocks.sweepVersions }));
vi.mock("@/lib/functions/deploy", () => ({
  reconcileAppOriginMarks: mocks.reconcileAppOriginMarks,
  reconcileAppOrigins: mocks.reconcileAppOrigins,
}));
vi.mock("@/lib/migration/sweep", () => ({
  reconcileMigrations: mocks.reconcileMigrations,
}));
vi.mock("@/lib/location/resolve", () => ({
  resolveDueLocationRequests: mocks.resolveDueLocationRequests,
}));
vi.mock("@/lib/trade/service", () => ({
  expireTradeApprovals: mocks.expireTradeApprovals,
  reconcileTradeOrders: mocks.reconcileTradeOrders,
}));
vi.mock("@/lib/trade/watch", () => ({ tickWatchlists: mocks.tickWatchlists }));

import { GET as adMetrics } from "./ad-metrics/route";
import { GET as ads } from "./ads/route";
import { GET as health } from "./health/route";
import { GET as publish } from "./publish/route";
import { GET as schedules } from "./schedules/route";
import { GET as sources } from "./sources/route";
import { GET as sweep } from "./sweep/route";
import { GET as trade } from "./trade/route";

const SECRET = "test-cron-secret";

type Handler = (request: NextRequest) => Promise<Response>;

const ROUTES: { name: string; get: Handler; sweep: () => unknown }[] = [
  { name: "ad-metrics", get: adMetrics, sweep: () => mocks.ingestOpenAiMetrics },
  { name: "ads", get: ads, sweep: () => mocks.sweepSpendCeilings },
  { name: "health", get: health, sweep: () => mocks.probeConnectionHealth },
  { name: "publish", get: publish, sweep: () => mocks.publishDueSlots },
  { name: "schedules", get: schedules, sweep: () => mocks.sweepSchedules },
  { name: "sources", get: sources, sweep: () => mocks.candidateUsers },
  { name: "sweep", get: sweep, sweep: () => mocks.findSweepableBoxes },
  { name: "trade", get: trade, sweep: () => mocks.expireTradeApprovals },
];

function get(token: string | null): NextRequest {
  return new NextRequest("https://air.test/api/cron/x", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["CRON_SECRET"] = SECRET;
});

describe.each(ROUTES)("GET /api/cron/$name", ({ name, get: handler, sweep }) => {
  it(`rejects everything when CRON_SECRET is unset (${name})`, async () => {
    delete process.env["CRON_SECRET"];
    expect((await handler(get(SECRET))).status).toBe(401);
    expect(sweep()).not.toHaveBeenCalled();
  });

  it(`rejects a wrong bearer token (${name})`, async () => {
    expect((await handler(get("wrong-secret"))).status).toBe(401);
    expect(sweep()).not.toHaveBeenCalled();
  });

  it(`rejects a missing bearer token (${name})`, async () => {
    expect((await handler(get(null))).status).toBe(401);
    expect(sweep()).not.toHaveBeenCalled();
  });

  it(`runs the sweep once for the right secret (${name})`, async () => {
    const response = await handler(get(SECRET));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(sweep()).toHaveBeenCalledTimes(1);
  });
});
