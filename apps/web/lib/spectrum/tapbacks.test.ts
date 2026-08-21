import { describe, expect, it } from "vitest";
import {
  asTapback,
  probeForTapback,
  TAPBACK_EMOJI,
  TAPBACK_PROBE_LIMIT,
} from "./tapbacks";

function stream(...chunks: string[]): AsyncIterator<string> {
  return (async function* () {
    for (const chunk of chunks) yield chunk;
  })();
}

async function collect(iterator: AsyncIterator<string>): Promise<string> {
  let out = "";
  for (;;) {
    const next = await iterator.next();
    if (next.done) return out;
    out += next.value;
  }
}

describe("asTapback", () => {
  it("accepts each tapback emoji", () => {
    for (const emoji of TAPBACK_EMOJI) {
      expect(asTapback(emoji)).toBe(emoji);
    }
  });

  it("accepts surrounding whitespace and a missing variation selector", () => {
    expect(asTapback(" 👍\n")).toBe("👍");
    expect(asTapback("\u2764")).toBe("\u2764\uFE0F");
    expect(asTapback("\u2757\u2757")).toBeUndefined();
  });

  it("rejects text, other emoji, and doubled tapbacks", () => {
    expect(asTapback("ok 👍")).toBeUndefined();
    expect(asTapback("🔥")).toBeUndefined();
    expect(asTapback("👍👍")).toBeUndefined();
    expect(asTapback("")).toBeUndefined();
  });
});

describe("probeForTapback", () => {
  it("detects a lone tapback across chunks", async () => {
    const probe = await probeForTapback(stream("👍"));
    expect(probe).toEqual({ tapback: "👍", buffered: "👍", ended: true });
  });

  it("stops probing once the reply is provably not a tapback", async () => {
    const first = "This reply is long enough to exceed the probe. ";
    const iterator = stream(first, "second chunk");
    const probe = await probeForTapback(iterator);
    expect(probe.tapback).toBeUndefined();
    expect(probe.ended).toBe(false);
    expect(probe.buffered).toBe(first);
    expect(probe.buffered.trim().length).toBeGreaterThan(TAPBACK_PROBE_LIMIT);
    expect(await collect(iterator)).toBe("second chunk");
  });

  it("returns a short non-tapback reply intact", async () => {
    const probe = await probeForTapback(stream("ok!"));
    expect(probe).toEqual({
      tapback: undefined,
      buffered: "ok!",
      ended: true,
    });
  });

  it("handles an empty stream", async () => {
    const probe = await probeForTapback(stream());
    expect(probe).toEqual({ tapback: undefined, buffered: "", ended: true });
  });
});
