/**
 * The icon lane charges through the same atomic reserve as every other upload:
 * an icon racing a reservation-based upload for the last bytes of the quota
 * cannot land unchecked, and a replacement releases the bytes it displaces
 * only once they are gone from R2.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import type { Row } from "@/lib/testing/fakeSupabase";

const db = new FakeSupabase();
const r2 = vi.hoisted(() => ({
  objects: new Map<string, number>(),
  log: [] as string[],
  putGate: null as Promise<void> | null,
  deleteObject: vi.fn(async (key: string) => {
    r2.log.push(`delete ${key}`);
    r2.objects.delete(key);
  }),
}));
const publish = vi.hoisted(() => ({
  app: { id: "app-1", slug: "party", icon_key: null as string | null },
}));

vi.mock("@/lib/miniapps/storeSession", () => ({
  storeSessionUserId: () => "owner-1",
}));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  ownedApp: async () => publish.app,
}));
vi.mock("@/lib/security/limits", () => ({
  uploadRateLimited: async () => false,
  recordOpsEvent: async () => undefined,
}));
vi.mock("@/lib/storage/guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/guard")>()),
  guardMediaUpload: (bytes: Buffer) => bytes,
}));
vi.mock("@/lib/storage/r2", () => ({
  r2Configured: () => true,
  publicUrl: (key: string) => `https://cdn.test/${key}`,
  headObject: async (key: string) => {
    const size = r2.objects.get(key);
    return size === undefined ? null : { sizeBytes: size, contentType: "image/png" };
  },
  putObject: vi.fn(async (key: string, body: Buffer) => {
    if (r2.putGate) await r2.putGate;
    r2.log.push(`put ${key} ${body.length}`);
    r2.objects.set(key, body.length);
  }),
  deleteObject: r2.deleteObject,
}));
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.client(),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { reserveQuota } from "@/lib/storage/buckets";
import { putObject } from "@/lib/storage/r2";
import { serviceClient } from "@/lib/supabase";

const ICON_KEY = "u/alice/icons/party.png";

function iconRequest(size: number, type = "image/png"): NextRequest {
  const form = new FormData();
  form.set("slug", "party");
  form.set("icon", new File([Buffer.alloc(size, 7)], "icon.png", { type }));
  return new NextRequest("https://air.test/api/mini/publish/icon", {
    method: "POST",
    body: form,
  });
}

function bucketRow(): Row {
  const row = db.rows("user_buckets")[0];
  if (!row) throw new Error("expected a user_buckets row");
  return row;
}

function setUsed(bytes: number): void {
  bucketRow()["bytes_used"] = bytes;
}

function used(): number {
  return Number(bucketRow()["bytes_used"]);
}

function rpcLog(): string[] {
  return db.rpcCalls.map(
    (c) => `${c.fn} ${(c.args as Record<string, unknown>)["p_bytes"]}`
  );
}

function appIconUpdates(): Record<string, unknown>[] {
  return db.updates
    .filter((u) => u.table === "mini_apps")
    .map((u) => u.patch);
}

// Quota lives on the user_buckets row; the real reserve/release are RPCs that
// mutate it atomically, so the fake mirrors them as functions over row state.
function seedLedger(usedBytes: number, quotaBytes = 1000): void {
  db.tables["user_buckets"] = [
    {
      user_id: "owner-1",
      prefix: "u/alice/",
      bytes_used: usedBytes,
      quota_bytes: quotaBytes,
    },
  ];
}

function wireQuotaRpcs(): void {
  db.rpcResults["user_bucket_reserve"] = (args: unknown) => {
    const a = args as Record<string, unknown>;
    const row = db
      .rows("user_buckets")
      .find((r) => r["user_id"] === a["p_user_id"]);
    const bytes = Number(a["p_bytes"]);
    if (
      !row ||
      bytes < 0 ||
      Number(row["bytes_used"]) + bytes > Number(row["quota_bytes"])
    ) {
      return false;
    }
    row["bytes_used"] = Number(row["bytes_used"]) + bytes;
    return true;
  };
  db.rpcResults["user_bucket_release"] = (args: unknown) => {
    const a = args as Record<string, unknown>;
    const row = db
      .rows("user_buckets")
      .find((r) => r["user_id"] === a["p_user_id"]);
    const bytes = Number(a["p_bytes"]);
    if (!row) return null;
    row["bytes_used"] = Math.max(Number(row["bytes_used"]) - bytes, 0);
    return row["bytes_used"];
  };
}

describe("icon upload quota accounting", () => {
  beforeEach(() => {
    db.reset();
    seedLedger(0);
    db.tables["mini_apps"] = [
      { id: "app-1", slug: "party", owner_user_id: "owner-1" },
    ];
    wireQuotaRpcs();
    r2.objects.clear();
    r2.log = [];
    r2.putGate = null;
    publish.app = { id: "app-1", slug: "party", icon_key: null };
  });

  it("a first icon reserves its full size before the put", async () => {
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(200);
    expect(rpcLog()).toEqual(["user_bucket_reserve 300"]);
    expect(used()).toBe(300);
    expect(r2.log).toEqual([`put ${ICON_KEY} 300`]);
    expect(db.rows("mini_apps")[0]).toMatchObject({ icon_key: ICON_KEY });
  });

  it("an icon that would overflow is refused with 413 and nothing reaches R2", async () => {
    setUsed(800);
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(413);
    expect(r2.log).toEqual([]);
    expect(used()).toBe(800);
    expect(appIconUpdates()).toEqual([]);
  });

  it("replacing an icon releases the displaced bytes only after the new object landed", async () => {
    setUsed(500);
    r2.objects.set(ICON_KEY, 200);
    publish.app.icon_key = ICON_KEY;
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(200);
    expect(rpcLog()).toEqual(["user_bucket_reserve 300", "user_bucket_release 200"]);
    expect(used()).toBe(600);
    expect(r2.log).toEqual([`put ${ICON_KEY} 300`]);
  });

  it("a stale object under a previous extension is deleted and released too", async () => {
    setUsed(500);
    r2.objects.set("u/alice/icons/party.jpg", 150);
    publish.app.icon_key = "u/alice/icons/party.jpg";
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(200);
    expect(r2.log).toEqual([`put ${ICON_KEY} 300`, "delete u/alice/icons/party.jpg"]);
    expect(rpcLog()).toEqual(["user_bucket_reserve 300", "user_bucket_release 150"]);
    expect(used()).toBe(650);
  });

  it("a replacement near the quota is judged on the new icon's full size, never on a stale read", async () => {
    // 900 of 1000 used, 200 of it the current icon; a same-size replacement
    // needs 200 free while the old object still exists, so it is refused
    // rather than transiently over-committing the row.
    setUsed(900);
    r2.objects.set(ICON_KEY, 200);
    publish.app.icon_key = ICON_KEY;
    const response = await POST(iconRequest(200));
    expect(response.status).toBe(413);
    expect(r2.objects.get(ICON_KEY)).toBe(200);
    expect(used()).toBe(900);
  });

  it("interleaving: an icon and a reservation-based upload racing for the last bytes — exactly one lands", async () => {
    // 400 free. The icon (300) reserves, then stalls in its put while a
    // presign-style upload reserves 300 on the same row.
    setUsed(600);
    let openGate!: () => void;
    r2.putGate = new Promise<void>((resolve) => (openGate = resolve));
    const icon = POST(iconRequest(300));
    await vi.waitFor(() => expect(rpcLog()).toContain("user_bucket_reserve 300"));
    await expect(reserveQuota(serviceClient(), "owner-1", 300)).rejects.toMatchObject({
      status: 413,
    });
    openGate();
    const response = await icon;
    expect(response.status).toBe(200);
    expect(used()).toBe(900);
    expect(r2.log).toEqual([`put ${ICON_KEY} 300`]);
  });

  it("interleaving, other order: the upload reserves first and the icon is refused before its put", async () => {
    setUsed(600);
    await reserveQuota(serviceClient(), "owner-1", 300);
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(413);
    expect(used()).toBe(900);
    expect(r2.log).toEqual([]);
  });

  it("a failed stale-extension delete keeps the new icon charged and the stale bytes charged", async () => {
    setUsed(150);
    r2.objects.set("u/alice/icons/party.jpg", 150);
    publish.app.icon_key = "u/alice/icons/party.jpg";
    r2.deleteObject.mockImplementationOnce(async () => {
      throw new Error("r2 delete failed: 503");
    });
    await expect(POST(iconRequest(300))).rejects.toThrow("r2 delete failed");
    expect(r2.objects.get(ICON_KEY)).toBe(300);
    expect(r2.objects.get("u/alice/icons/party.jpg")).toBe(150);
    expect(rpcLog()).toEqual(["user_bucket_reserve 300"]);
    expect(used()).toBe(450);
  });

  it("a put failure gives the reservation back", async () => {
    vi.mocked(putObject).mockImplementationOnce(async () => {
      throw new Error("r2 put failed: 503");
    });
    await expect(POST(iconRequest(300))).rejects.toThrow("r2 put failed");
    expect(rpcLog()).toEqual(["user_bucket_reserve 300", "user_bucket_release 300"]);
    expect(used()).toBe(0);
  });
});
