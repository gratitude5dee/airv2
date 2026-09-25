/**
 * R-SEC-04: the Create bridge rejects a replayed signature. A request whose
 * x-air-sig was already claimed inside the ±300 s tolerance window is a
 * 409 — the signature itself is the nonce (HMAC over
 * ts.METHOD.path.sha256(body), so a replay is byte-identical).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adapterBody } from "./adapter";
import { bridgePayload, bridgeSign } from "./bridge";

const SECRET = "test-bridge-secret";
const PATH = "/api/internal/create/dev-expire";

beforeAll(() => {
  process.env["CREATE_BRIDGE_SECRET"] = SECRET;
});

/** In-memory stand-in for the create_bridge_nonces claim queries. */
function nonceDb(): SupabaseClient {
  const claimed = new Set<string>();
  const deleted: string[] = [];
  return {
    from: (table: string) => {
      if (table !== "create_bridge_nonces") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        delete: () => ({
          lt: (column: string, cutoff: string) => {
            deleted.push(`${column}<${cutoff}`);
            return Promise.resolve({ data: [], error: null });
          },
        }),
        upsert: (row: { sig: string }) => ({
          select: () => {
            const fresh = !claimed.has(row.sig);
            if (fresh) claimed.add(row.sig);
            return Promise.resolve({
              data: fresh ? [row] : [],
              error: null,
            });
          },
        }),
      };
    },
  } as unknown as SupabaseClient;
}

function signedRequest(body: string, ts?: string): NextRequest {
  const stamp = ts ?? String(Math.floor(Date.now() / 1000));
  const sig = bridgeSign(SECRET, bridgePayload(stamp, "POST", PATH, body));
  return new NextRequest(`https://vercel.internal${PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-air-ts": stamp,
      "x-air-sig": sig,
    },
    body,
  });
}

describe("R-SEC-04: create bridge replay protection", () => {
  it("accepts the first signed request and rejects its replay with 409", async () => {
    const supabase = nonceDb();
    const raw = JSON.stringify({ now: "2026-09-25T00:00:00Z" });

    const ts = String(Math.floor(Date.now() / 1000));
    const first = await adapterBody(supabase, signedRequest(raw, ts));
    expect(first.body).toEqual({ now: "2026-09-25T00:00:00Z" });

    await expect(
      adapterBody(supabase, signedRequest(raw, ts))
    ).rejects.toEqual(expect.objectContaining({ status: 409 }));
  });

  it("claims a fresh signature even when the body differs", async () => {
    const supabase = nonceDb();
    const ts = String(Math.floor(Date.now() / 1000));
    await adapterBody(supabase, signedRequest("{}", ts));
    await expect(
      adapterBody(supabase, signedRequest("{}", ts))
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      adapterBody(
        supabase,
        signedRequest('{"now":"2026-01-01T00:00:00Z"}', ts)
      )
    ).resolves.toBeTruthy();
  });

  it("never claims a nonce for a bad signature", async () => {
    const supabase = nonceDb();
    const request = new NextRequest(`https://vercel.internal${PATH}`, {
      method: "POST",
      headers: {
        "x-air-ts": String(Math.floor(Date.now() / 1000)),
        "x-air-sig": "deadbeef",
      },
      body: "{}",
    });
    await expect(adapterBody(supabase, request)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      adapterBody(supabase, signedRequest("{}"))
    ).resolves.toBeTruthy();
  });
});
