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
import { profileRevision } from "@/lib/memory/files";

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
    expect(body.user_revision).toBe(profileRevision("user profile"));
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

  it("compare-and-swaps on the box when the owner echoes the loaded revision", async () => {
    const base = profileRevision("user profile");
    const response = await PUT(
      new NextRequest(url, {
        method: "PUT",
        body: JSON.stringify({ user: "I prefer tea.", base_revision: base }),
      })
    );
    expect(response.status).toBe(200);
    expect((await response.json()).user_revision).toBe(
      profileRevision("I prefer tea.")
    );
    expect(box.writeFile).not.toHaveBeenCalled();
    expect(box.command).toHaveBeenCalledTimes(1);
    const script = box.command.mock.calls[0]?.[1] ?? "";
    expect(script).toContain(`'${base}'`);
    expect(script).toContain("'I prefer tea.'");
    expect(script).toContain("mv -f");
  });

  it("409s instead of overwriting a profile the agent rewrote meanwhile", async () => {
    box.command.mockResolvedValueOnce({ exitCode: 3, stdout: "", stderr: "" });
    const response = await PUT(
      new NextRequest(url, {
        method: "PUT",
        body: JSON.stringify({
          user: "I prefer tea.",
          base_revision: profileRevision("stale"),
        }),
      })
    );
    expect(response.status).toBe(409);
    expect((await response.json()).conflict).toBe(true);
    expect(box.writeFile).not.toHaveBeenCalled();
  });

  it("rejects a malformed base_revision before touching the box", async () => {
    const response = await PUT(
      new NextRequest(url, {
        method: "PUT",
        body: JSON.stringify({ user: "hi", base_revision: "'; rm -rf ~'" }),
      })
    );
    expect(response.status).toBe(400);
    expect(box.command).not.toHaveBeenCalled();
    expect(box.writeFile).not.toHaveBeenCalled();
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

  it("offers (never forces) a deep memory clear when both files are cleared", async () => {
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({ action: "clear", target: "both", confirm: true }),
      })
    );
    expect(await response.json()).toEqual({ ok: true, deep_memory_offer: true });
    expect(box.command).toHaveBeenCalledTimes(1);
    expect(box.command.mock.calls[0]?.[1]).not.toContain("ovctl");
  });

  it.each(["memory", "user"] as const)("does not offer a deep memory clear for target %s", async (target) => {
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        body: JSON.stringify({ action: "clear", target, confirm: true }),
      })
    );
    expect(await response.json()).toEqual({ ok: true });
  });
});
