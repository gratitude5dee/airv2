/**
 * R-ARCH-03: the request-body contract — every API route that reads
 * `await request.json()` must validate through `parseBody` (or a
 * `safeParse` in the same file). The allowlist is the tracked migration
 * frontier: entries may only be REMOVED as routes are migrated, never
 * added — the next body-validation PRs shrink it to zero.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_DIR = join(__dirname, "../../app/api");

const ALLOWLIST: readonly string[] = [
  "app/api/admin/ads/route.ts",
  "app/api/admin/boxes/reprovision/route.ts",
  "app/api/admin/create/apps/[slug]/dev/route.ts",
  "app/api/admin/delete/route.ts",
  "app/api/admin/fleet/channels/route.ts",
  "app/api/admin/fleet/releases/route.ts",
  "app/api/admin/fleet/sync/route.ts",
  "app/api/admin/mailboxes/ensure/route.ts",
  "app/api/admin/migrations/route.ts",
  "app/api/admin/ops/route.ts",
  "app/api/admin/publish-pause/route.ts",
  "app/api/admin/settings/route.ts",
  "app/api/ads/accounts/route.ts",
  "app/api/ads/conversions/route.ts",
  "app/api/ads/groups/route.ts",
  "app/api/ads/meta/confirm/route.ts",
  "app/api/ads/metrics/route.ts",
  "app/api/ads/pixels/route.ts",
  "app/api/ads/writes/route.ts",
  "app/api/apps/v1/media-upload-url/route.ts",
  "app/api/assets/route.ts",
  "app/api/auth/login/route.ts",
  "app/api/auth/signup/route.ts",
  "app/api/berd/pair/route.ts",
  "app/api/berd/result/route.ts",
  "app/api/bots/[name]/chat/route.ts",
  "app/api/bots/rooms/[id]/send/route.ts",
  "app/api/bots/rooms/route.ts",
  "app/api/box/wake/route.ts",
  "app/api/brand/route.ts",
  "app/api/browser/fill/route.ts",
  "app/api/browser/otp/route.ts",
  "app/api/browser/route.ts",
  "app/api/browser/social/route.ts",
  "app/api/buzz/pair/route.ts",
  "app/api/buzz/result/route.ts",
  "app/api/calendar/accounts/route.ts",
  "app/api/calendar/remind/route.ts",
  "app/api/cards/[kind]/route.ts",
  "app/api/checkout/handoff/route.ts",
  "app/api/commerce/shopify/route.ts",
  "app/api/content/plan/route.ts",
  "app/api/create/build/route.ts",
  "app/api/create/compile/route.ts",
  "app/api/create/drop/route.ts",
  "app/api/create/files/route.ts",
  "app/api/create/go/route.ts",
  "app/api/create/icon/route.ts",
  "app/api/create/import/route.ts",
  "app/api/create/intake/route.ts",
  "app/api/create/jobs/[id]/request/route.ts",
  "app/api/create/plan/deliver/route.ts",
  "app/api/create/preview-link/route.ts",
  "app/api/create/projects/route.ts",
  "app/api/create/release/route.ts",
  "app/api/create/rollback/route.ts",
  "app/api/create/tier/route.ts",
  "app/api/create/turn/route.ts",
  "app/api/decisions/route.ts",
  "app/api/desktop/chat/route.ts",
  "app/api/desktop/session/route.ts",
  "app/api/email/drafts/review/route.ts",
  "app/api/gateway/v1/[...path]/route.ts",
  "app/api/kernel/action/[id]/route.ts",
  "app/api/kernel/browser/route.ts",
  "app/api/kernel/purchase/route.ts",
  "app/api/kernel/vault/route.ts",
  "app/api/learning/feedback/route.ts",
  "app/api/learning/settings/route.ts",
  "app/api/me/imessage-history/resolutions/route.ts",
  "app/api/me/memory/deep/route.ts",
  "app/api/me/memory/route.ts",
  "app/api/media/publish/route.ts",
  "app/api/mini/agent/route.ts",
  "app/api/mini/checkout-launch/route.ts",
  "app/api/mini/grant/route.ts",
  "app/api/mini/install/route.ts",
  "app/api/mini/launch/route.ts",
  "app/api/mini/link/route.ts",
  "app/api/mini/login/route.ts",
  "app/api/mini/publish/route.ts",
  "app/api/mini/publish/status/route.ts",
  "app/api/miniapps/commerce/route.ts",
  "app/api/muse/air/[capability]/route.ts",
  "app/api/onairos/route.ts",
  "app/api/plugin/auth/start/route.ts",
  "app/api/plugin/auth/token/route.ts",
  "app/api/senders/route.ts",
  "app/api/settings/home-order/route.ts",
  "app/api/settings/model/route.ts",
  "app/api/settings/plugins/route.ts",
  "app/api/settings/speed/route.ts",
  "app/api/settings/username/route.ts",
  "app/api/skills/route.ts",
  "app/api/slots/[id]/route.ts",
  "app/api/slots/route.ts",
  "app/api/trade/route.ts",
  "app/api/vault/managers/route.ts",
];

const RAW_JSON = /await\s+request\.json\s*\(/;

function* routeFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* routeFiles(path);
    } else if (entry === "route.ts" || entry === "route.tsx") {
      yield path;
    }
  }
}

/** Violator = reads `await request.json()` with no validator in-file. */
function isViolator(path: string): boolean {
  const src = readFileSync(path, "utf8");
  return (
    RAW_JSON.test(src) && !src.includes("parseBody") && !src.includes("safeParse")
  );
}

describe("request body guard", () => {
  it("rejects raw request.json() outside the migration allowlist", () => {
    const violations: string[] = [];
    for (const path of routeFiles(API_DIR)) {
      const rel = relative(join(API_DIR, "../.."), path);
      if (ALLOWLIST.includes(rel)) continue;
      if (isViolator(path)) violations.push(rel);
    }
    expect(violations).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still violates", () => {
    for (const rel of ALLOWLIST) {
      const path = join(API_DIR, "../..", rel);
      expect(
        isViolator(path),
        `${rel} no longer reads a raw body — remove it from the allowlist`
      ).toBe(true);
    }
  });
});
