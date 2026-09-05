/**
 * The icon lane charges through the same atomic reserve as every other upload:
 * an icon racing a reservation-based upload for the last bytes of the quota
 * cannot land unchecked, and a replacement releases the bytes it displaces
 * only once they are gone from R2.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const ledger = vi.hoisted(() => ({
  used: 0,
  quota: 0,
  rpcs: [] as string[],
  updates: [] as Record<string, unknown>[],
}));
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
  serviceClient: () =>
    ({
      from(table: string) {
        if (table === "user_buckets") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    user_id: "owner-1",
                    prefix: "u/alice/",
                    bytes_used: ledger.used,
                    quota_bytes: ledger.quota,
                  },
                }),
              }),
            }),
          };
        }
        if (table === "mini_apps") {
          return {
            update: (patch: Record<string, unknown>) => ({
              eq: async () => {
                ledger.updates.push(patch);
                return { error: null };
              },
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      async rpc(name: string, args: Record<string, unknown>) {
        const bytes = Number(args["p_bytes"]);
        ledger.rpcs.push(`${name} ${bytes}`);
        if (name === "user_bucket_reserve") {
          if (bytes >= 0 && ledger.used + bytes <= ledger.quota) {
            ledger.used += bytes;
            return { data: true, error: null };
          }
          return { data: false, error: null };
        }
        if (name === "user_bucket_release") {
          ledger.used = Math.max(ledger.used - bytes, 0);
          return { data: ledger.used, error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      },
    }) as unknown as SupabaseClient,
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

describe("icon upload quota accounting", () => {
  beforeEach(() => {
    ledger.used = 0;
    ledger.quota = 1000;
    ledger.rpcs = [];
    ledger.updates = [];
    r2.objects.clear();
    r2.log = [];
    r2.putGate = null;
    publish.app = { id: "app-1", slug: "party", icon_key: null };
  });

  it("a first icon reserves its full size before the put", async () => {
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(200);
    expect(ledger.rpcs).toEqual(["user_bucket_reserve 300"]);
    expect(ledger.used).toBe(300);
    expect(r2.log).toEqual([`put ${ICON_KEY} 300`]);
    expect(ledger.updates[0]).toMatchObject({ icon_key: ICON_KEY });
  });

  it("an icon that would overflow is refused with 413 and nothing reaches R2", async () => {
    ledger.used = 800;
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(413);
    expect(r2.log).toEqual([]);
    expect(ledger.used).toBe(800);
    expect(ledger.updates).toEqual([]);
  });

  it("replacing an icon releases the displaced bytes only after the new object landed", async () => {
    ledger.used = 500;
    r2.objects.set(ICON_KEY, 200);
    publish.app.icon_key = ICON_KEY;
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(200);
    expect(ledger.rpcs).toEqual(["user_bucket_reserve 300", "user_bucket_release 200"]);
    expect(ledger.used).toBe(600);
    expect(r2.log).toEqual([`put ${ICON_KEY} 300`]);
  });

  it("a stale object under a previous extension is deleted and released too", async () => {
    ledger.used = 500;
    r2.objects.set("u/alice/icons/party.jpg", 150);
    publish.app.icon_key = "u/alice/icons/party.jpg";
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(200);
    expect(r2.log).toEqual([`put ${ICON_KEY} 300`, "delete u/alice/icons/party.jpg"]);
    expect(ledger.rpcs).toEqual(["user_bucket_reserve 300", "user_bucket_release 150"]);
    expect(ledger.used).toBe(650);
  });

  it("a replacement near the quota is judged on the new icon's full size, never on a stale read", async () => {
    // 900 of 1000 used, 200 of it the current icon; a same-size replacement
    // needs 200 free while the old object still exists, so it is refused
    // rather than transiently over-committing the row.
    ledger.used = 900;
    r2.objects.set(ICON_KEY, 200);
    publish.app.icon_key = ICON_KEY;
    const response = await POST(iconRequest(200));
    expect(response.status).toBe(413);
    expect(r2.objects.get(ICON_KEY)).toBe(200);
    expect(ledger.used).toBe(900);
  });

  it("interleaving: an icon and a reservation-based upload racing for the last bytes — exactly one lands", async () => {
    // 400 free. The icon (300) reserves, then stalls in its put while a
    // presign-style upload reserves 300 on the same row.
    ledger.used = 600;
    let openGate!: () => void;
    r2.putGate = new Promise<void>((resolve) => (openGate = resolve));
    const icon = POST(iconRequest(300));
    await vi.waitFor(() => expect(ledger.rpcs).toContain("user_bucket_reserve 300"));
    await expect(reserveQuota(serviceClient(), "owner-1", 300)).rejects.toMatchObject({
      status: 413,
    });
    openGate();
    const response = await icon;
    expect(response.status).toBe(200);
    expect(ledger.used).toBe(900);
    expect(r2.log).toEqual([`put ${ICON_KEY} 300`]);
  });

  it("interleaving, other order: the upload reserves first and the icon is refused before its put", async () => {
    ledger.used = 600;
    await reserveQuota(serviceClient(), "owner-1", 300);
    const response = await POST(iconRequest(300));
    expect(response.status).toBe(413);
    expect(ledger.used).toBe(900);
    expect(r2.log).toEqual([]);
  });

  it("a failed stale-extension delete keeps the new icon charged and the stale bytes charged", async () => {
    ledger.used = 150;
    r2.objects.set("u/alice/icons/party.jpg", 150);
    publish.app.icon_key = "u/alice/icons/party.jpg";
    r2.deleteObject.mockImplementationOnce(async () => {
      throw new Error("r2 delete failed: 503");
    });
    await expect(POST(iconRequest(300))).rejects.toThrow("r2 delete failed");
    expect(r2.objects.get(ICON_KEY)).toBe(300);
    expect(r2.objects.get("u/alice/icons/party.jpg")).toBe(150);
    expect(ledger.rpcs).toEqual(["user_bucket_reserve 300"]);
    expect(ledger.used).toBe(450);
  });

  it("a put failure gives the reservation back", async () => {
    vi.mocked(putObject).mockImplementationOnce(async () => {
      throw new Error("r2 put failed: 503");
    });
    await expect(POST(iconRequest(300))).rejects.toThrow("r2 put failed");
    expect(ledger.rpcs).toEqual(["user_bucket_reserve 300", "user_bucket_release 300"]);
    expect(ledger.used).toBe(0);
  });
});
