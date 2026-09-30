/**
 * Token-provider account settings: entitlements.token_provider chooses
 * where a user's turns draw tokens from (WZRD pool vs their own ChatGPT /
 * Claude subscription) and byo_model pins a specific model on the BYO
 * provider — both service-role-only columns the user row can't self-write.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

import {
  clearByoModel,
  isTokenProvider,
  setByoModel,
  setTokenProvider,
  TOKEN_PROVIDER_LABELS,
  TOKEN_PROVIDERS,
} from "./account";

const db = new FakeSupabase();
const supabase = db.client();

const entitlementRow = () => {
  const row = db.tables["entitlements"]?.[0];
  if (!row) throw new Error("missing entitlement row");
  return row;
};

beforeEach(() => {
  db.reset();
  db.tables["entitlements"] = [{ user_id: "u-1", token_provider: "wzrd" }];
});

describe("isTokenProvider", () => {
  it("accepts the three providers and nothing else", () => {
    expect(TOKEN_PROVIDERS).toEqual(["wzrd", "openai", "anthropic"]);
    for (const provider of TOKEN_PROVIDERS) {
      expect(isTokenProvider(provider)).toBe(true);
      expect(TOKEN_PROVIDER_LABELS[provider].length).toBeGreaterThan(0);
    }
    expect(isTokenProvider("gmi")).toBe(false);
    expect(isTokenProvider("")).toBe(false);
  });
});

describe("setTokenProvider / byo_model", () => {
  it("writes the provider and clears the pin on demand", async () => {
    expect(await setTokenProvider(supabase, "u-1", "openai")).toBe(true);
    expect(entitlementRow()["token_provider"]).toBe("openai");

    expect(await setByoModel(supabase, "u-1", "gpt-5.4")).toBe(true);
    expect(entitlementRow()["byo_model"]).toBe("gpt-5.4");

    expect(await clearByoModel(supabase, "u-1")).toBe(true);
    expect(entitlementRow()["byo_model"]).toBeNull();
  });

  it("rejects an unknown provider without touching the row", async () => {
    expect(await setTokenProvider(supabase, "u-1", "gemini" as never)).toBe(false);
    expect(entitlementRow()["token_provider"]).toBe("wzrd");
  });
});
