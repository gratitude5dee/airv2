import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publishDueSlots } from "./worker";

const throwingClient = new Proxy(
  {},
  {
    get() {
      throw new Error("supabase must not be touched when killed");
    },
  }
) as SupabaseClient;

afterEach(() => {
  delete process.env["PUBLISH_KILL_SWITCH"];
});

describe("publish kill switch", () => {
  it("halts the sweep before any query and leaves slots untouched", async () => {
    process.env["PUBLISH_KILL_SWITCH"] = "1";
    const result = await publishDueSlots(throwingClient);
    expect(result).toEqual({
      usersWoken: 0,
      published: 0,
      parked: 0,
      deferred: 0,
      retried: 0,
    });
  });

  it("runs the sweep when the switch is off", async () => {
    await expect(publishDueSlots(throwingClient)).rejects.toThrow(
      "supabase must not be touched when killed"
    );
  });
});
