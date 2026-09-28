import { describe, expect, it, vi } from "vitest";
import { TokenReplay } from "../dispatcher/index.mjs";

function fakeCtx() {
  const data = new Map<string, unknown>();
  return {
    alarms: [] as number[],
    storage: {
      get: async (key: string) => data.get(key),
      put: async (key: string, value: unknown) => void data.set(key, value),
      deleteAll: async () => data.clear(),
      setAlarm: async (when: number) => data.set("__alarm", when),
    },
    _data: data,
  };
}

describe("TokenReplay (exactly-once jti)", () => {
  it("first redeem wins; every later redeem loses", async () => {
    const do_ = new TokenReplay(fakeCtx(), {});
    await expect(do_.redeem(60)).resolves.toBe(true);
    await expect(do_.redeem(60)).resolves.toBe(false);
    await expect(do_.redeem(60)).resolves.toBe(false);
  });

  it("sets the self-delete alarm at 2x ttl", async () => {
    const ctx = fakeCtx();
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const do_ = new TokenReplay(ctx, {});
    await do_.redeem(60);
    expect(ctx._data.get("__alarm")).toBe(121_000);
    vi.restoreAllMocks();
  });

  it("alarm erases the instance state", async () => {
    const do_ = new TokenReplay(fakeCtx(), {});
    await do_.redeem(60);
    await do_.alarm();
    await expect(do_.redeem(60)).resolves.toBe(true);
  });
});
