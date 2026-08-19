/**
 * MA9.2 — Onairos route contract: owner session required, the SSRF guard
 * blocks hostile apiUrls before any egress, persona content lands box-side
 * only (Postgres sees provider/status metadata), and disconnect deletes
 * every Onairos-derived byte.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ userId: undefined as string | undefined }));
vi.mock("@/lib/auth/user", () => ({
  sessionUserId: () => auth.userId,
}));

const db = vi.hoisted(() => ({
  upserts: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/supabase", () => {
  function builder() {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "eq"]) chain[method] = vi.fn(self);
    chain.maybeSingle = async () => ({ data: null });
    chain.upsert = vi.fn(async (row: Record<string, unknown>) => {
      db.upserts.push(row);
      return { error: null };
    });
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));

const box = vi.hoisted(() => ({
  files: {} as Record<string, string>,
  removed: [] as string[],
}));
vi.mock("@/lib/box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    if (path in box.files) return box.files[path];
    throw new Error("not found");
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    box.files[path] = content;
  }),
  command: vi.fn(async (_boxId: string, script: string) => {
    if (script.startsWith("rm -f ")) box.removed.push(script);
    return { exitCode: 0, stdout: "", stderr: "" };
  }),
}));

const fetchSpy = vi.fn(
  async () =>
    new Response(
      JSON.stringify({
        traits: { archetype: "Builder", user_summary: "Ships things." },
      }),
      { status: 200 }
    )
);
vi.stubGlobal("fetch", fetchSpy);

import { DELETE, GET, POST } from "./route";

const url = "https://air.test/api/onairos";
const HANDOFF = {
  token: "short-lived-token",
  apiUrl: "https://api2.onairos.uk/inferenceTest/traits",
};

beforeEach(() => {
  auth.userId = "user-1";
  db.upserts = [];
  box.files = {};
  box.removed = [];
  fetchSpy.mockClear();
});

describe("/api/onairos", () => {
  it("401s all methods without a session", async () => {
    auth.userId = undefined;
    expect((await GET(new NextRequest(url))).status).toBe(401);
    expect(
      (
        await POST(
          new NextRequest(url, { method: "POST", body: JSON.stringify(HANDOFF) })
        )
      ).status
    ).toBe(401);
    expect(
      (await DELETE(new NextRequest(url, { method: "DELETE" }))).status
    ).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks hostile apiUrls before any egress (SSRF guard)", async () => {
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          token: "t",
          apiUrl: "https://169.254.169.254/latest/meta-data",
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(db.upserts).toHaveLength(0);
  });

  it("connect writes context box-side; Postgres gets status metadata only", async () => {
    const response = await POST(
      new NextRequest(url, { method: "POST", body: JSON.stringify(HANDOFF) })
    );
    expect(response.status).toBe(200);
    // persona fetch went to the handoff apiUrl with the bearer token
    const [target] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(target).toBe(HANDOFF.apiUrl);
    // box-side artifacts
    expect(box.files[".hermes/context/onairos.md"]).toContain("Builder");
    expect(box.files[".hermes/context/onairos.json"]).toContain(
      "Ships things."
    );
    expect(box.files[".hermes/memories/USER.md"]).toContain("onairos.md");
    // metadata-only row: no token, no apiUrl, no persona bytes
    expect(db.upserts).toHaveLength(1);
    const row = JSON.stringify(db.upserts[0]);
    expect(db.upserts[0]?.provider).toBe("onairos");
    expect(db.upserts[0]?.status).toBe("active");
    expect(row).not.toContain("short-lived-token");
    expect(row).not.toContain("Ships things");
    expect(row).not.toContain("onairos.uk");
    // response carries no persona bytes either
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("Ships things");
    expect(body).not.toContain("short-lived-token");
  });

  it("disconnect deletes every Onairos-derived byte", async () => {
    await POST(
      new NextRequest(url, { method: "POST", body: JSON.stringify(HANDOFF) })
    );
    const response = await DELETE(new NextRequest(url, { method: "DELETE" }));
    expect(response.status).toBe(200);
    expect(box.removed.join(" ")).toContain(".hermes/context/onairos.md");
    expect(box.removed.join(" ")).toContain(".hermes/context/onairos.json");
    expect(box.removed.join(" ")).toContain(".onairos-grant.json");
    expect(box.files[".hermes/memories/USER.md"]).not.toContain("Onairos");
    expect(db.upserts.at(-1)?.status).toBe("revoked");
  });
});
