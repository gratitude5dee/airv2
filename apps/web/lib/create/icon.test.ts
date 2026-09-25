import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";
import { makeApp } from "@/app/mini/loader-test-utils";

const r2 = vi.hoisted(() => ({ putObject: vi.fn<(key: string, body: Buffer, type: string) => Promise<void>>() }));
vi.mock("../storage/r2", () => ({ putObject: r2.putObject }));

const limits = vi.hoisted(() => ({ recordOpsEvent: vi.fn(async () => undefined) }));
vi.mock("../security/limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../security/limits")>()),
  recordOpsEvent: limits.recordOpsEvent,
}));

const creative = vi.hoisted(() => ({
  createCreativeJob: vi.fn(async () => ({ id: "job-1" })),
  executeCreativeJob: vi.fn(),
}));
vi.mock("../creative/jobs", () => ({ createCreativeJob: creative.createCreativeJob }));
vi.mock("../creative/run", () => ({ executeCreativeJob: creative.executeCreativeJob }));

const compute = vi.hoisted(() => ({
  ensureComputeAwake: vi.fn(async () => ({ instanceId: "bx_1", environment: "box" })),
  runCommand: vi.fn<(target: unknown, cmd: string, timeout?: number) => Promise<{ exitCode: number; stdout: string; stderr: string }>>(),
}));
vi.mock("../compute/awake", () => ({ ensureComputeAwake: compute.ensureComputeAwake }));
vi.mock("../compute/runtime", () => ({ runCommand: compute.runCommand }));
vi.mock("../compute/environments", () => ({ isBoxEnvironment: () => true }));
const boxes = vi.hoisted(() => ({ armStopAfter: vi.fn(async () => undefined) }));
vi.mock("../orchestrator/boxes", () => ({ armStopAfter: boxes.armStopAfter }));

const plan = vi.hoisted(() => ({ ownerThread: vi.fn() }));
vi.mock("./plan", () => ({ ownerThread: plan.ownerThread }));

import {
  countIconGenerations,
  generateIcon,
  generationAllowed,
  ICON_GENERATIONS_MAX,
  ICON_PREVIEW_LINE,
  iconFilePath,
  iconKeys,
  iconPlan,
  iconPrompt,
  IconError,
  readBoxIcon,
  resizeIcon,
  sendIconPreview,
  sha256Hex,
  sniffImageType,
  storeIcon,
} from "./icon";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 3)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(20)]);

const app = makeApp({ slug: "alice-promo", appname: "promo", owner_user_id: "user-alice", name: "Promo", description: "A tour page." });

const db = new FakeSupabase();
const supabase = db.client();

/** Seed `ops_events` rows the way `recordOpsEvent` writes them: the icon
 * generation counter reads the ledger by kind + user_id + ref. */
function seedIconEvents(userId: string, slug: string, n: number): void {
  db.tables["ops_events"] = Array.from({ length: n }, (_, i) => ({
    id: `evt-${i}`,
    kind: "upload",
    user_id: userId,
    ref: `icon_generate:${slug}`,
    created_at: new Date().toISOString(),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  delete process.env["CREATE_ICON_MODEL"];
});

describe("pure helpers", () => {
  it("iconKeys: content-addressed under apps/<slug>/icon/", () => {
    const sha = sha256Hex(PNG);
    expect(iconKeys("alice-promo", sha)).toEqual({
      key: `apps/alice-promo/icon/${sha}.png`,
      smallKey: `apps/alice-promo/icon/${sha}-180.png`,
    });
  });

  it("iconPrompt: the fixed template with optional theme hue words", () => {
    expect(iconPrompt({ name: "Promo", description: "A tour page." })).toBe(
      "Promo: A tour page. Flat, single subject, no text, centered, 1:1. App icon."
    );
    expect(iconPrompt({ name: "Promo", description: "", theme: "pixel" })).toBe(
      "Promo. Flat, single subject, no text, centered, 1:1, bold saturated pixel-art hues. App icon."
    );
    expect(iconPlan("p")).toMatchObject({ mode: "imagine", expanded_prompt: "p", params: { aspect_ratio: "1:1" } });
  });

  it("generationAllowed: two free, the third refused", () => {
    expect(ICON_GENERATIONS_MAX).toBe(2);
    expect(generationAllowed(0)).toBe(true);
    expect(generationAllowed(1)).toBe(true);
    expect(generationAllowed(2)).toBe(false);
    expect(generationAllowed(Number.NaN)).toBe(false);
  });

  it("iconFilePath: inside the workspace, image extensions only", () => {
    expect(iconFilePath("promo", "public/icon.png")).toBe(".hermes/create/promo/public/icon.png");
    expect(iconFilePath("promo", "~/.hermes/create/promo/icon.JPG")).toBe(".hermes/create/promo/icon.JPG");
    expect(() => iconFilePath("promo", "../other/icon.png")).toThrow(IconError);
    expect(() => iconFilePath("promo", "/etc/passwd")).toThrow(IconError);
    expect(() => iconFilePath("promo", "public/icon.svg")).toThrow(IconError);
    expect(() => iconFilePath("promo", ".build/icon.png")).toThrow(IconError);
    expect(() => iconFilePath("Bad Name", "icon.png")).toThrow(IconError);
  });

  it("sniffImageType reads magic bytes", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(Buffer.from("<svg/>"))).toBeNull();
  });
});

describe("resizeIcon", () => {
  it("returns 512 and 180 PNGs through sharp when it resolves", async () => {
    const calls: number[] = [];
    const sharp = (() => ({
      resize: (w: number) => ({ png: () => ({ toBuffer: async () => (calls.push(w), Buffer.from(`png${w}`)) }) }),
    })) as unknown as Parameters<typeof resizeIcon>[1] extends () => Promise<infer S> ? NonNullable<S> : never;
    const out = await resizeIcon(PNG, async () => sharp);
    expect(out.resized).toBe(true);
    expect(out.icon.toString()).toBe("png512");
    expect(out.small?.toString()).toBe("png180");
    expect(calls.sort()).toEqual([180, 512]);
  });

  it("falls back to the guarded original once when sharp is not resolvable", async () => {
    const out = await resizeIcon(PNG, async () => null);
    expect(out).toEqual({ icon: PNG, small: null, resized: false });
  });

  it("the real sharp resolves in this tree and produces square PNGs", async () => {
    const sharp = (await import("sharp")).default;
    const source = await sharp({ create: { width: 30, height: 20, channels: 4, background: "#f00" } }).png().toBuffer();
    const out = await resizeIcon(source);
    expect(out.resized).toBe(true);
    expect(sniffImageType(out.icon)).toBe("image/png");
    const meta = await sharp(out.icon).metadata();
    expect([meta.width, meta.height]).toEqual([512, 512]);
    const small = await sharp(out.small!).metadata();
    expect([small.width, small.height]).toEqual([180, 180]);
  });
});

describe("storeIcon", () => {
  it("guards, resizes, puts both keys and writes icon_key = the 512 key", async () => {
    db.tables["mini_apps"] = [{ ...app }];
    const resize = async () => ({ icon: Buffer.from("big"), small: Buffer.from("small"), resized: true });
    const stored = await storeIcon(supabase, app, PNG, "image/png", { resize });
    const sha = sha256Hex(Buffer.from("big"));
    expect(stored).toEqual({ icon_key: `apps/alice-promo/icon/${sha}.png`, resized: true });
    expect(r2.putObject.mock.calls.map((call) => call[0])).toEqual([
      `apps/alice-promo/icon/${sha}.png`,
      `apps/alice-promo/icon/${sha}-180.png`,
    ]);
    expect(db.updates[0]).toMatchObject({
      table: "mini_apps",
      patch: expect.objectContaining({ icon_key: stored.icon_key }),
    });
    expect(db.rows("mini_apps")[0]?.["icon_key"]).toBe(stored.icon_key);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "upload", "user-alice", "icon:alice-promo", 3);
  });

  it("stores the original once (no -180) when resizing is unavailable", async () => {
    const resize = async () => ({ icon: PNG, small: null, resized: false });
    const stored = await storeIcon(supabase, app, PNG, "image/png", { resize });
    expect(stored.resized).toBe(false);
    expect(r2.putObject).toHaveBeenCalledTimes(1);
    expect(r2.putObject.mock.calls[0]?.[0]).toBe(`apps/alice-promo/icon/${sha256Hex(PNG)}.png`);
  });

  it("refuses non-image types and oversize uploads before touching R2", async () => {
    await expect(storeIcon(supabase, app, PNG, "image/svg+xml")).rejects.toBeInstanceOf(IconError);
    await expect(storeIcon(supabase, app, Buffer.alloc(8 * 1024 * 1024 + 1), "image/png")).rejects.toMatchObject({
      status: 413,
    });
    expect(r2.putObject).not.toHaveBeenCalled();
  });
});

describe("readBoxIcon", () => {
  it("reads the file base64 through the command lane and sniffs the type", async () => {
    compute.runCommand.mockResolvedValue({ exitCode: 0, stdout: `${JPEG.toString("base64")}\n`, stderr: "" });
    const read = await readBoxIcon(supabase, "user-alice", "promo", "public/icon.jpg");
    expect(read.contentType).toBe("image/jpeg");
    expect(read.bytes.equals(JPEG)).toBe(true);
    expect(String(compute.runCommand.mock.calls[0]?.[1])).toContain('"$HOME/.hermes/create/promo/public/icon.jpg"');
    expect(boxes.armStopAfter).toHaveBeenCalled();
  });

  it("404 on a missing file, 415 on a non-image", async () => {
    compute.runCommand.mockResolvedValueOnce({ exitCode: 3, stdout: "", stderr: "" });
    await expect(readBoxIcon(supabase, "user-alice", "promo", "icon.png")).rejects.toMatchObject({ status: 404 });
    compute.runCommand.mockResolvedValueOnce({ exitCode: 0, stdout: Buffer.from("<svg/>").toString("base64"), stderr: "" });
    await expect(readBoxIcon(supabase, "user-alice", "promo", "icon.png")).rejects.toMatchObject({ status: 415 });
  });
});

describe("generateIcon", () => {
  it("counts the generation, renders on CREATE_ICON_MODEL with the fixed prompt and returns the asset bytes", async () => {
    process.env["CREATE_ICON_MODEL"] = "gemini-3.1-flash-image";
    creative.executeCreativeJob.mockResolvedValue({
      status: "delivered",
      line: "",
      asset: { id: "asset-1", storage_key: "u/alice/x.png", ext: "png" },
    });
    db.storageObjects["creative-assets/u/alice/x.png"] = PNG;
    const out = await generateIcon(supabase, "user-alice", app, { theme: "atmosphere" });
    expect(out.contentType).toBe("image/png");
    expect(out.bytes.equals(PNG)).toBe(true);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "upload", "user-alice", "icon_generate:alice-promo");
    expect(creative.createCreativeJob).toHaveBeenCalledWith(expect.anything(), "user-alice", "web", "imagine");
    const [, jobId, userId, turn, options] = creative.executeCreativeJob.mock.calls[0] as unknown as [
      unknown,
      string,
      string,
      { text: string },
      { model: string; plan: { expanded_prompt: string }; promptVersion: string },
    ];
    expect([jobId, userId]).toEqual(["job-1", "user-alice"]);
    expect(turn.text).toBe(iconPrompt({ name: "Promo", description: "A tour page.", theme: "atmosphere" }));
    expect(options.model).toBe("gemini-3.1-flash-image");
    expect(options.plan.expanded_prompt).toBe(turn.text);
    expect(options.promptVersion).toBe("create.icon.v1");
  });

  it("a refused or failed render is an IconError with the lane's line", async () => {
    creative.executeCreativeJob.mockResolvedValueOnce({ status: "refused", line: "can't draw that" });
    await expect(generateIcon(supabase, "user-alice", app)).rejects.toMatchObject({ status: 422, message: "can't draw that" });
    creative.executeCreativeJob.mockResolvedValueOnce({ status: "failed", line: "busy" });
    await expect(generateIcon(supabase, "user-alice", app)).rejects.toMatchObject({ status: 502 });
  });

  it("countIconGenerations reads the ops ledger by kind + ref", async () => {
    seedIconEvents("user-alice", "alice-promo", 2);
    expect(await countIconGenerations(supabase, "user-alice", "alice-promo")).toBe(2);
  });
});

describe("sendIconPreview", () => {
  it("attaches the PNG to the owner's thread and follows with the one line", async () => {
    plan.ownerThread.mockResolvedValue({ spaceId: "space-1", phone: "+15551234567" });
    const sender = { sendAttachment: vi.fn(async () => undefined), sendText: vi.fn(async () => undefined) };
    const sent = await sendIconPreview(
      supabase,
      sender as unknown as Parameters<typeof sendIconPreview>[1],
      "user-alice",
      "promo",
      PNG
    );
    expect(sent).toBe(true);
    expect(sender.sendAttachment).toHaveBeenCalledWith("space-1", "+15551234567", PNG, { name: "promo-icon.png", mimeType: "image/png" });
    expect(sender.sendText).toHaveBeenCalledWith("space-1", "+15551234567", ICON_PREVIEW_LINE);
    plan.ownerThread.mockResolvedValue(null);
    expect(await sendIconPreview(supabase, sender as unknown as Parameters<typeof sendIconPreview>[1], "u", "promo", PNG)).toBe(false);
  });
});
