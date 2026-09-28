import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpectrumSender } from "../spectrum/sender";
import { FakeSupabase } from "../testing/fakeSupabase";

const boxes = vi.hoisted(() => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
  armStopAfter: vi.fn(async () => undefined),
}));
vi.mock("../orchestrator/boxes", () => boxes);
const compute = vi.hoisted(() => ({
  loadTarget: vi.fn(async () => ({ kind: "box", boxId: "box-1" })),
  readComputeFile: vi.fn(async (): Promise<string> => "# Plan\n\nline"),
}));
vi.mock("../compute/runtime", () => compute);
const cards = vi.hoisted(() => ({ sendMarkedCards: vi.fn(async () => 1) }));
vi.mock("../miniapps/cards", () => cards);

import {
  PLAN_MAX_BYTES,
  PlanError,
  deliverPlan,
  ownerThread,
  planFilePath,
  planSummary,
} from "./plan";

const db = new FakeSupabase();
const supabase = db.client();
const destinationRow = { user_id: "user-alice", space_id: "space-1", phone: "+15550001" };

const sender = {
  sendAttachment: vi.fn(async () => undefined),
  sendText: vi.fn(async () => undefined),
} as unknown as SpectrumSender & {
  sendAttachment: ReturnType<typeof vi.fn>;
  sendText: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  db.reset();
  db.tables["imessage_destinations"] = [{ ...destinationRow }];
  compute.readComputeFile.mockResolvedValue("# Plan\n\nline");
});

describe("planFilePath", () => {
  it("accepts workspace-relative and home-rooted spellings of the same file", () => {
    for (const path of [
      "plan.md",
      "./plan.md",
      "~/.hermes/create/promo/plan.md",
      "$HOME/.hermes/create/promo/plan.md",
      "/root/.hermes/create/promo/plan.md",
      "/home/hermes/.hermes/create/promo/plan.md",
      ".hermes/create/promo/plan.md",
    ]) {
      expect(planFilePath("promo", path), path).toBe(".hermes/create/promo/plan.md");
    }
    expect(planFilePath("promo", "plan.v3.md")).toBe(".hermes/create/promo/plan.v3.md");
    expect(planFilePath("promo", "intake/plan.md")).toBe(".hermes/create/promo/intake/plan.md");
  });

  it("refuses traversal, other workspaces, absolute strays, dotfiles and non-markdown", () => {
    for (const path of [
      "../promo2/plan.md",
      "~/.hermes/create/promo/../promo2/plan.md",
      "~/.hermes/create/other/plan.md",
      "/etc/plan.md",
      "~/plan.md",
      "plan.md/",
      "plan",
      "plan.MD.txt",
      ".env.md",
      "intake/.hidden.md",
      "",
      "x".repeat(600),
    ]) {
      expect(() => planFilePath("promo", path), path).toThrow(PlanError);
    }
    expect(() => planFilePath("Bad Name", "plan.md")).toThrow(PlanError);
  });
});

describe("planSummary", () => {
  it("keeps the first 12 lines only", () => {
    const text = Array.from({ length: 30 }, (_, i) => `l${i}`).join("\r\n");
    expect(planSummary(text).split("\n")).toHaveLength(12);
    expect(planSummary("one\ntwo")).toBe("one\ntwo");
  });
});

describe("ownerThread", () => {
  it("returns the tier-0 destination or null; a read error is a 503", async () => {
    expect(await ownerThread(supabase, "user-alice")).toEqual({ spaceId: "space-1", phone: "+15550001" });
    db.expectQuery({ table: "imessage_destinations", filters: { user_id: "user-alice" } });
    db.tables["imessage_destinations"] = [];
    expect(await ownerThread(supabase, "user-alice")).toBeNull();
    db.errors["imessage_destinations"] = { message: "down" };
    await expect(ownerThread(supabase, "user-alice")).rejects.toMatchObject({ status: 503 });
  });
});

describe("deliverPlan (CR21)", () => {
  it("wakes the Box, reads the file once, attaches it and re-arms stop-after", async () => {
    const receipt = await deliverPlan(supabase, sender, "user-alice", { appname: "promo", path: "plan.md" });
    expect(receipt).toEqual({ delivered: "attachment", bytes: Buffer.byteLength("# Plan\n\nline") });
    expect(boxes.ensureBoxAwake).toHaveBeenCalledWith(supabase, "user-alice");
    expect(compute.readComputeFile).toHaveBeenCalledTimes(1);
    expect(boxes.armStopAfter).toHaveBeenCalledWith(supabase, "user-alice");
    const [spaceId, phone, bytes, options] = sender.sendAttachment.mock.calls[0]!;
    expect([spaceId, phone]).toEqual(["space-1", "+15550001"]);
    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(options).toEqual({ name: "promo-plan.md", mimeType: "text/markdown" });
  });

  it("falls back to text + [card: create] and keeps the bytes out of the log", async () => {
    sender.sendAttachment.mockRejectedValueOnce(new Error("no media"));
    const receipt = await deliverPlan(supabase, sender, "user-alice", { appname: "promo", path: "plan.md" });
    expect(receipt.delivered).toBe("text");
    expect(sender.sendText).toHaveBeenCalledWith("space-1", "+15550001", "# Plan\n\nline");
    expect(cards.sendMarkedCards).toHaveBeenCalledWith(
      supabase,
      { userId: "user-alice", spaceId: "space-1", phone: "+15550001" },
      ["create"]
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("# Plan");
  });

  it("checks the thread before waking the Box, and caps the size", async () => {
    db.tables["imessage_destinations"] = [];
    await expect(
      deliverPlan(supabase, sender, "user-alice", { appname: "promo", path: "plan.md" })
    ).rejects.toMatchObject({ status: 409 });
    expect(boxes.ensureBoxAwake).not.toHaveBeenCalled();
    db.tables["imessage_destinations"] = [{ ...destinationRow }];
    compute.readComputeFile.mockResolvedValueOnce("y".repeat(PLAN_MAX_BYTES + 1));
    await expect(
      deliverPlan(supabase, sender, "user-alice", { appname: "promo", path: "plan.md" })
    ).rejects.toMatchObject({ status: 413 });
    expect(boxes.armStopAfter).toHaveBeenCalled();
    expect(sender.sendAttachment).not.toHaveBeenCalled();
  });
});
