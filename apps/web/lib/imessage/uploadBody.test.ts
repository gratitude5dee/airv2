import { describe, expect, it, vi } from "vitest";
import { readUploadBody, UploadTooLargeError } from "./uploadBody";

describe("bounded upload body", () => {
  it("accepts the exact byte limit with multibyte characters split across reads", async () => {
    const data = new TextEncoder().encode("🧠");
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(data.slice(0, 2));
      controller.enqueue(data.slice(2));
      controller.close();
    } });
    const request = { body } as Request;
    expect(await readUploadBody(request, 4)).toBe("🧠");
  });

  it("cancels an oversized stream without consuming the rest", async () => {
    let reads = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(3)); },
      cancel,
    }, { highWaterMark: 0 });
    await expect(readUploadBody({ body } as Request, 4)).rejects.toBeInstanceOf(UploadTooLargeError);
    expect(cancel).toHaveBeenCalledOnce();
    expect(reads).toBe(2);
    expect(body.locked).toBe(false);
  });

  it("propagates stream failures and releases the lock", async () => {
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error("disconnected")); } });
    await expect(readUploadBody({ body } as Request, 4)).rejects.toThrow("disconnected");
    expect(body.locked).toBe(false);
  });
});
