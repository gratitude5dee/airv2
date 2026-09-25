import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { db, DbWriteError } from "./db";

vi.mock("./log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const pgError = {
  message: "duplicate key value violates unique constraint",
  code: "23505",
  details: "Key (id)=(1) already exists.",
  hint: null,
};

describe("db.write", () => {
  it("returns data when the query succeeds", async () => {
    const data = await db.write(Promise.resolve({ data: { id: 1 }, error: null }), {
      what: "test write",
    });
    expect(data).toEqual({ id: 1 });
  });

  it("throws DbWriteError with the query context when error is set", async () => {
    const promise = db.write(Promise.resolve({ data: null, error: pgError }), {
      what: "insert widget",
    });
    await expect(promise).rejects.toBeInstanceOf(DbWriteError);
    await expect(promise).rejects.toMatchObject({
      name: "DbWriteError",
      what: "insert widget",
      pg: { code: "23505" },
    });
  });

  it("logs user_id, box_id, and pg details on failure", async () => {
    const { log } = await import("./log");
    await db
      .write(Promise.resolve({ data: null, error: pgError }), {
        what: "flush insert",
        user_id: "u1",
        box_id: "b1",
      })
      .catch(() => undefined);
    expect(log.error).toHaveBeenCalledWith(
      "supabase write failed",
      expect.objectContaining({
        user_id: "u1",
        box_id: "b1",
        what: "flush insert",
        pg_code: "23505",
      })
    );
  });
});

/**
 * R-ARCH-05 ratchet: Supabase builders never throw — a bare
 * `await supabase…` statement that writes (insert/update/delete/upsert/rpc)
 * and neither destructures `error` nor ends in `.catch(…)`/`.then(…)`
 * silently swallows the failure. The map below pins today's per-file count
 * of such statements: shrink it (through `db.write` or explicit handling),
 * never grow it.
 */
const UNCHECKED_WRITE_BASELINE: Record<string, number> = {
  "app/api/admin/ads/route.ts": 1,
  "app/api/admin/delete/route.ts": 4,
  "app/api/auth/login/route.ts": 3,
  "app/api/auth/signup/route.ts": 2,
  "app/api/bots/[name]/avatar/route.ts": 1,
  "app/api/bots/rooms/route.ts": 1,
  "app/api/box/stop/route.ts": 2,
  "app/api/browser/otp/route.ts": 6,
  "app/api/browser/route.ts": 4,
  "app/api/calendar/accounts/route.ts": 1,
  "app/api/calendar/schedule/route.ts": 1,
  "app/api/chat/[runId]/stop/route.ts": 1,
  "app/api/computer/keepawake/route.ts": 1,
  "app/api/cron/sweep/route.ts": 6,
  "app/api/decisions/route.ts": 3,
  "app/api/desktop/session/route.ts": 1,
  "app/api/inbound/calcom/route.ts": 1,
  "app/api/mini/agent/route.ts": 1,
  "app/api/mini/install/route.ts": 1,
  "app/api/mini/publish/status/route.ts": 1,
  "app/api/slots/[id]/publish/route.ts": 1,
  "app/api/slots/[id]/route.ts": 2,
  "app/api/slots/route.ts": 1,
  "lib/ads/approvals.ts": 3,
  "lib/ads/reconcile.ts": 1,
  "lib/ads/sweep.ts": 2,
  "lib/approvals/hosted.ts": 2,
  "lib/assets/pipeline.ts": 3,
  "lib/bots/chat.ts": 1,
  "lib/box/desktop.ts": 1,
  "lib/brand/mirror.ts": 1,
  "lib/browser/rules.ts": 2,
  "lib/calendar/sweep.ts": 6,
  "lib/chat/relay.ts": 1,
  "lib/commerce/catalog.ts": 2,
  "lib/commerce/checkout.ts": 9,
  "lib/commerce/merchants.ts": 2,
  "lib/commerce/payLinks.ts": 1,
  "lib/commerce/paymentRequests.ts": 11,
  "lib/compute/awake.ts": 1,
  "lib/connectors/manage.ts": 4,
  "lib/context/importer.ts": 1,
  "lib/create/finalize.ts": 1,
  "lib/create/mirror.ts": 1,
  "lib/create/versions.ts": 2,
  "lib/creative/store.ts": 1,
  "lib/decisions/batch.ts": 1,
  "lib/decisions/email.ts": 1,
  "lib/email/inbound.ts": 1,
  "lib/entitlements/spend.ts": 1,
  "lib/fleet/sync.ts": 6,
  "lib/functions/approval.ts": 2,
  "lib/functions/backend.ts": 4,
  "lib/functions/runtime.ts": 2,
  "lib/identity/assets.ts": 2,
  "lib/kernel/browsers.ts": 3,
  "lib/kernel/purchases.ts": 3,
  "lib/kernel/vaults.ts": 1,
  "lib/learning/learning.ts": 1,
  "lib/location/requests.ts": 2,
  "lib/location/resolve.ts": 1,
  "lib/masterkey/runs.ts": 6,
  "lib/masterkey/spend.ts": 1,
  "lib/migration/admission.ts": 1,
  "lib/migration/driver.ts": 1,
  "lib/migration/operations.ts": 3,
  "lib/migration/steps.ts": 2,
  "lib/miniapps/berd/link.ts": 6,
  "lib/miniapps/buzz/link.ts": 6,
  "lib/miniapps/cardSends.ts": 1,
  "lib/miniapps/commandLane.ts": 3,
  "lib/miniapps/draw.ts": 8,
  "lib/miniapps/freeze.ts": 5,
  "lib/muse/capabilities.ts": 2,
  "lib/muse/commands.ts": 2,
  "lib/muse/keys.ts": 1,
  "lib/muse/link.ts": 2,
  "lib/orchestrator/boxes.ts": 9,
  "lib/orchestrator/flush.ts": 21,
  "lib/orchestrator/idleStop.ts": 3,
  "lib/plugin/auth.ts": 2,
  "lib/provisioning/connectors.ts": 1,
  "lib/provisioning/email.ts": 2,
  "lib/provisioning/onboarding.ts": 7,
  "lib/provisioning/provision.ts": 4,
  "lib/publish/agentPlan.ts": 4,
  "lib/publish/propose.ts": 5,
  "lib/publish/worker.ts": 5,
  "lib/trade/service.ts": 14,
  "lib/vault/purchase.ts": 3,
  "lib/wallet/send.ts": 5,
};

const WRITE_RE = /\.(insert|update|delete|upsert|rpc)\s*\(/;
const AWAIT_RE = /await\s+supabase/g;
// A statement is checked when it binds `error` (destructure, `.error`, a
// follow-up condition inside the statement) or routes through
// `.catch`/`.then`.
const HANDLED_RE = /\berror\b|\.catch\s*\(|\.then\s*\(/;

function statementBounds(src: string, pos: number): [number, number] {
  // Backward to the previous `;` — braces and parens pass through so a
  // destructured `{ data, error }` binding is inside the window.
  let start = 0;
  for (let j = pos - 1; j >= 0; j -= 1) {
    if (src[j] === ";") {
      start = j + 1;
      break;
    }
  }
  const semi = src.indexOf(";", pos);
  return [start, semi === -1 ? src.length : semi];
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) yield path;
  }
}

describe("unchecked supabase writes (R-ARCH-05)", () => {
  const appRoot = fileURLToPath(new URL("..", import.meta.url));

  it("the baseline does not grow per file", () => {
    const growth: string[] = [];
    for (const path of walk(appRoot)) {
      const src = readFileSync(path, "utf8");
      let count = 0;
      for (const m of src.matchAll(AWAIT_RE)) {
        const [s, e] = statementBounds(src, m.index);
        const stmt = src.slice(s, e);
        if (WRITE_RE.test(stmt) && !HANDLED_RE.test(stmt)) count += 1;
      }
      const rel = relative(appRoot, path).replaceAll("\\", "/");
      const baseline = UNCHECKED_WRITE_BASELINE[rel] ?? 0;
      if (count > baseline) {
        growth.push(`${rel}: ${count} unchecked writes (baseline ${baseline})`);
      }
    }
    expect(
      growth,
      `new unchecked \`await supabase\` writes detected — route them through db.write() or destructure { error }:\n${growth.join("\n")}`
    ).toEqual([]);
  });
});
