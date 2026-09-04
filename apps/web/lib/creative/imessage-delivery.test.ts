/**
 * Silent-delivery regression: a /zap turn can reach `status=delivered` in
 * `creative_jobs` while every outbound Spectrum send rejects, which used to
 * leave the chat completely silent and the logs completely clean. The lane
 * must still consume the burst, but the failure has to be observable.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { maybeRunCreativeLane } from "./imessage";
import { createCreativeJob } from "./jobs";
import { executeCreativeJob } from "./run";

vi.mock("./jobs", () => ({ createCreativeJob: vi.fn() }));
vi.mock("./run", () => ({ executeCreativeJob: vi.fn() }));
vi.mock("./store", () => ({
  removeStagedInputs: vi.fn().mockResolvedValue(undefined),
  stageCreativeInputs: vi.fn().mockResolvedValue([]),
}));

const job = { spaceId: "sp", userId: "u1", phone: "+1555" };

const supabaseWithAsset = () =>
  ({
    storage: {
      from: () => ({
        download: () =>
          Promise.resolve({
            error: null,
            data: new Blob([new Uint8Array([1, 2, 3])]),
          }),
      }),
    },
  }) as unknown as SupabaseClient;

const deadSender = () => {
  const boom = () => Promise.reject(new Error("spectrum stream closed"));
  return {
    sendText: vi.fn(boom),
    sendAttachment: vi.fn(boom),
    sendRichLink: vi.fn(boom),
    getAttachment: vi.fn(),
  } as unknown as Parameters<typeof maybeRunCreativeLane>[1];
};

describe("creative delivery observability", () => {
  beforeEach(() => {
    vi.mocked(createCreativeJob).mockResolvedValue({
      id: "job-1",
    } as Awaited<ReturnType<typeof createCreativeJob>>);
    vi.mocked(executeCreativeJob).mockResolvedValue({
      status: "delivered",
      line: "here is your video",
      deliveryLine: "here is your video",
      deliveryUrl: "https://example.test/signed",
      asset: {
        storage_key: "assets/u1/a.mp4",
        sha256: "abcdef1234567890",
        ext: "mp4",
      },
    } as Awaited<ReturnType<typeof executeCreativeJob>>);
  });

  it("logs every failed send and one silent-turn marker", async () => {
    const errors: string[] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((line: unknown) => {
        errors.push(String(line));
      });
    const sender = deadSender();

    const handled = await maybeRunCreativeLane(
      supabaseWithAsset(),
      sender,
      job,
      "/zap intro animation"
    );

    spy.mockRestore();
    expect(handled).toBe(true);
    const stages = errors
      .map((line) => JSON.parse(line) as { msg: string; stage?: string })
      .filter((entry) => entry.msg === "creative delivery send failed")
      .map((entry) => entry.stage);
    expect(stages).toEqual([
      "ack",
      "attachment",
      "rich_link",
      "delivery_url",
      "caption",
    ]);
    const silent = errors
      .map((line) => JSON.parse(line) as { msg: string; job_id?: string })
      .find((entry) => entry.msg === "creative delivery silent");
    expect(silent).toMatchObject({ job_id: "job-1", user_id: "u1" });
  });

  it("stays quiet about silence when the caption reaches the chat", async () => {
    const errors: string[] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((line: unknown) => {
        errors.push(String(line));
      });
    const sender = {
      sendText: vi.fn().mockResolvedValue(undefined),
      sendAttachment: vi.fn().mockResolvedValue(undefined),
      sendRichLink: vi.fn().mockResolvedValue(undefined),
      getAttachment: vi.fn(),
    } as unknown as Parameters<typeof maybeRunCreativeLane>[1];

    await maybeRunCreativeLane(
      supabaseWithAsset(),
      sender,
      job,
      "/zap intro animation"
    );

    spy.mockRestore();
    expect(errors).toEqual([]);
  });
});
