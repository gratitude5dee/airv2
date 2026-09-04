/**
 * A photo and its /zap arrive as separate iMessage bubbles. Once the flush
 * debounce has folded them into one burst, the lane must read them as one
 * command with one reference — whichever bubble came first — and open
 * exactly one creative job. The turn handed to the executor is what fal
 * eventually sees, so its media kinds decide the endpoint.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpectrumSender } from "../spectrum/sender";
import { createCreativeJob } from "./jobs";
import { executeCreativeJob } from "./run";
import { removeStagedInputs, stageCreativeInputs } from "./store";
import { maybeRunCreativeLane } from "./imessage";
import { composeInput } from "../orchestrator/flush";

vi.mock("./jobs", () => ({ createCreativeJob: vi.fn() }));
vi.mock("./run", () => ({ executeCreativeJob: vi.fn() }));
vi.mock("./store", () => ({
  stageCreativeInputs: vi.fn(),
  removeStagedInputs: vi.fn().mockResolvedValue(undefined),
}));

const ATTACHMENTS: Record<string, { mimeType: string; kind: "image" | "video" | "audio" }> = {
  "att-photo": { mimeType: "image/heic", kind: "image" },
  "att-clip": { mimeType: "video/quicktime", kind: "video" },
  "att-memo": { mimeType: "audio/x-m4a", kind: "audio" },
};

const sender = () =>
  ({
    sendText: vi.fn().mockResolvedValue(undefined),
    sendAttachment: vi.fn().mockResolvedValue(undefined),
    sendRichLink: vi.fn().mockResolvedValue(undefined),
    getAttachment: vi.fn((id: string) => {
      const known = ATTACHMENTS[id];
      return Promise.resolve(
        known
          ? { data: Buffer.from(id), mimeType: known.mimeType, name: id }
          : undefined
      );
    }),
  }) as unknown as SpectrumSender & {
    sendText: ReturnType<typeof vi.fn>;
    getAttachment: ReturnType<typeof vi.fn>;
  };

const supabase = {} as SupabaseClient;
const job = { spaceId: "sp", userId: "u1", phone: "+1555" };

const queued = (
  body: string,
  offsetMs: number
): Parameters<typeof composeInput>[0][number] => ({
  id: `q-${offsetMs}`,
  message_id: `m-${offsetMs}`,
  body,
});

describe("/zap and its media as separate bubbles", () => {
  beforeEach(() => {
    vi.mocked(createCreativeJob).mockReset();
    vi.mocked(executeCreativeJob).mockReset();
    vi.mocked(stageCreativeInputs).mockReset();
    vi.mocked(removeStagedInputs).mockClear();
    vi.mocked(createCreativeJob).mockResolvedValue({
      id: "job-1",
    } as Awaited<ReturnType<typeof createCreativeJob>>);
    vi.mocked(executeCreativeJob).mockResolvedValue({
      status: "refused",
      line: "stubbed",
    });
    vi.mocked(stageCreativeInputs).mockImplementation(
      (_db, _user, bytes, mimeType) => {
        const kind = ATTACHMENTS[bytes.toString()]?.kind ?? "image";
        return Promise.resolve([
          {
            url: `https://storage.test/${bytes.toString()}`,
            kind,
            mimeType: mimeType === "image/heic" ? "image/jpeg" : mimeType,
            storageKey: `staged/${bytes.toString()}`,
          },
        ]);
      }
    );
  });

  const lastTurn = () => vi.mocked(executeCreativeJob).mock.calls[0]?.[3];

  it.each([
    ["photo, then /zap", "[attachment:att-photo]", "/zap make it rain", "image"],
    ["/zap, then photo", "/zap make it rain", "[attachment:att-photo]", "image"],
    ["clip, then /zap", "[attachment:att-clip]", "/zap make it rain", "video"],
    ["/zap, then clip", "/zap make it rain", "[attachment:att-clip]", "video"],
  ] as const)("%s → one job with that reference", async (_name, first, second, kind) => {
    const s = sender();
    const burst = composeInput([], [queued(first, 0), queued(second, 2_000)]);

    const handled = await maybeRunCreativeLane(supabase, s, job, burst);

    expect(handled).toBe(true);
    expect(createCreativeJob).toHaveBeenCalledTimes(1);
    expect(executeCreativeJob).toHaveBeenCalledTimes(1);
    const turn = lastTurn();
    expect(turn?.mode).toBe("zap");
    expect(turn?.cleanedText).toBe("make it rain");
    expect(turn?.mediaInputs.map((media) => media.kind)).toEqual([kind]);
    expect(removeStagedInputs).toHaveBeenCalledWith(supabase, [
      kind === "image" ? "staged/att-photo" : "staged/att-clip",
    ]);
  });

  it("media that the debounce carried from an earlier burst still counts", async () => {
    const s = sender();
    const burst = composeInput(
      [queued("[attachment:att-photo]", 0)],
      [queued("/zap make it rain", 2_500)]
    );

    await maybeRunCreativeLane(supabase, s, job, burst);

    expect(createCreativeJob).toHaveBeenCalledTimes(1);
    expect(lastTurn()?.mediaInputs.map((media) => media.kind)).toEqual(["image"]);
  });

  it("one bubble carrying photo, clip, memo and the command stages every kind", async () => {
    const s = sender();
    const burst = composeInput(
      [],
      [queued("[attachment:att-photo,att-clip,att-memo]\n/zap cut to the beat", 0)]
    );

    await maybeRunCreativeLane(supabase, s, job, burst);

    expect(createCreativeJob).toHaveBeenCalledTimes(1);
    expect(lastTurn()?.mediaInputs.map((media) => media.kind)).toEqual([
      "image",
      "video",
      "audio",
    ]);
    expect(s.getAttachment).toHaveBeenCalledTimes(3);
  });

  it("a memo alone reaches the executor, which refuses before fal", async () => {
    const s = sender();
    const burst = composeInput(
      [],
      [queued("[attachment:att-memo]", 0), queued("/zap vibe", 1_000)]
    );

    await maybeRunCreativeLane(supabase, s, job, burst);

    expect(lastTurn()?.mediaInputs.map((media) => media.kind)).toEqual(["audio"]);
    // The executor's refusal line is what the chat sees, after the ack.
    expect(s.sendText).toHaveBeenLastCalledWith("sp", "+1555", "stubbed");
  });

  it("a media-only burst is not a creative command", async () => {
    const s = sender();

    const handled = await maybeRunCreativeLane(
      supabase,
      s,
      job,
      composeInput([], [queued("[attachment:att-photo]", 0)])
    );

    expect(handled).toBe(false);
    expect(createCreativeJob).not.toHaveBeenCalled();
    expect(s.getAttachment).not.toHaveBeenCalled();
  });
});
