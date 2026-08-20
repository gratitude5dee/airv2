import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithHeaderTimeout, requestSignal } from "./timeout";

/** A fetch that never answers until its signal aborts. */
function hangingFetch(): typeof fetch {
  return ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(
          (init.signal as AbortSignal).reason ??
            new DOMException("aborted", "AbortError")
        )
      );
    })) as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestSignal", () => {
  it("rejects a hung fetch once the timeout elapses", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    await expect(
      fetch("https://upstream.invalid/", { signal: requestSignal(25) })
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("prefers a caller-supplied signal over the timeout", () => {
    const own = new AbortController().signal;
    expect(requestSignal(25, own)).toBe(own);
  });
});

describe("fetchWithHeaderTimeout", () => {
  it("rejects when headers never arrive", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    await expect(
      fetchWithHeaderTimeout("https://upstream.invalid/", {}, 25)
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("does not abort the body after headers arrived", async () => {
    let aborted = false;
    vi.stubGlobal("fetch", ((_input: RequestInfo | URL, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
      });
      return Promise.resolve(new Response("ok"));
    }) as typeof fetch);
    const response = await fetchWithHeaderTimeout(
      "https://upstream.invalid/",
      {},
      25
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(aborted).toBe(false);
    expect(await response.text()).toBe("ok");
  });
});
