/**
 * MA9.1 — Memory route invariants: owner session required, edits bounded by
 * the Hermes USER.md char limit, clears demand an explicit confirm, and
 * memory bytes never touch Postgres (the supabase client is never called
 * with content — only box wrappers move the bytes).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ userId: undefined as string | undefined }));
vi.mock("@/lib/auth/user", () => ({
  sessionUserId: () => auth.userId,
}));

const supabaseFrom = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({ from: supabaseFrom }),
}));

vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));

const box = vi.hoisted(() => ({
  readFile: vi.fn(async (_boxId: string, path: string) =>
    path.endsWith("MEMORY.md") ? "secret agent notes" : "user profile"
  ),
  writeFile: vi.fn(async () => undefined),
  command: vi.fn(async (boxId: string, script: string) => {
    void boxId;
    void script;
    return { exitCode: 0, stdout: "", stderr: "" };
  }),
}));
vi.mock("@/lib/box/client", () => box);

import { GET, POST, PUT } from "./route";

const url = "https://air.test/api/me/memory";

beforeEach(() => {
  auth.userId = "user-1";
  supabaseFrom.mockClear();
  box.writeFile.mockClear();
  box.command.mockClear();
});

describe("GET /api/me/memory", () => {
  it("401s without a session", async () => {
    auth.userId = undefined;
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(401);
  });

  it("returns both files via box read, never touching Postgres tables", async () => {
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.memory).toBe("secret agent notes");
    expect(body.user).toBe("user profile");
    expect(supabaseFrom).not.toHaveBeenCalled();
  });
});

describe("PUT /api/me/memory", () => {
  it("writes USER.md within the char limit", async () => {
    const response = await PUT(
      new NextRequest(url, {
        method: "PUT",
        body: JSON.stringify({ user: "I prefer tea." }),
      })
    );
    expect(response.status).toBe(200);
    expect(box.writeFile).toHaveBeenCalledWith(
      "box-1",
      ".hermes/memories/USER.md",
      "I prefer tea."
    );
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("rejects oversized profiles", async () => {
    const response = await PUT(
      new NextRequest(url, {
        method: "PUT",
        body: JSON.stringify({ user: "x".repeat(1376) }),
      })
    );
    expect(response.status).toBe(400);
    expect(box.writeFile).not.toHaveBeenCalled();
  });

  it("401s without a session", async () => {
    auth.userId = undefined;
    const response = await PUT(
      new NextRequest(url, {
        method: "PUT",
        body: JSON.stringify({ user: "hi" }),
      })
    );
    expect(response.status).toBe(401);
  });
});

describe("POST /api/me/memory (clear)", () => {
  it("requires confirm", async () => {
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({ action: "clear", target: "both" }),
      })
    );
    expect(response.status).toBe(400);
    expect(box.command).not.toHaveBeenCalled();
  });

  it("rejects unknown targets", async () => {
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({
          action: "clear",
          target: "../../etc",
          confirm: true,
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(box.command).not.toHaveBeenCalled();
  });

  it("clears with confirm via fixed box paths", async () => {
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({ action: "clear", target: "both", confirm: true }),
      })
    );
    expect(response.status).toBe(200);
    const script = box.command.mock.calls[0]?.[1] ?? "";
    expect(script).toContain(".hermes/memories/MEMORY.md");
    expect(script).toContain(".hermes/memories/USER.md");
    expect(supabaseFrom).not.toHaveBeenCalled();
  });
});
