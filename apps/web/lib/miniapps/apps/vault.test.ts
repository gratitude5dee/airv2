/**
 * Vault mini-app render behaviour (R-TQ-08): a pending purchase_review
 * decision renders as the approve/deny card inside the vault surface —
 * the "is rendered" half of the purchase_review closed-vocabulary check
 * that used to grep this file's source text.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "./types";
import { makeApp } from "@/app/mini/loader-test-utils";

vi.mock("@/lib/miniapps/promptBar", () => ({
  promptBar: () => "",
  runPrompt: vi.fn(),
}));

import { vault } from "./vault";

interface TableFixture {
  rows?: unknown[];
  single?: unknown;
}

function makeSupabase(fixtures: Record<string, TableFixture>): SupabaseClient {
  const from = (tableName: string) => {
    const fixture = fixtures[tableName] ?? {};
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of [
      "select",
      "eq",
      "is",
      "not",
      "gt",
      "order",
      "limit",
      "in",
    ]) {
      builder[method] = chain;
    }
    builder["maybeSingle"] = async () => ({
      data: fixture.single ?? null,
      error: null,
    });
    builder["then"] = (
      resolve: (value: { data: unknown[]; error: null }) => unknown
    ) => Promise.resolve({ data: fixture.rows ?? [], error: null }).then(resolve);
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

function context(
  fixtures: Record<string, TableFixture>,
  url = "https://app.wzrd.tech/mini/vault"
): MiniAppContext {
  return {
    request: new NextRequest(url),
    supabase: makeSupabase(fixtures),
    app: makeApp({ slug: "vault" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/vault",
  } as MiniAppContext;
}

describe("vault mini-app render", () => {
  it("renders a pending purchase_review as an approve/deny card", async () => {
    const response = await vault.render(
      context({
        vault_items: { rows: [] },
        vault_managers: { rows: [] },
        vault_events: { rows: [] },
        otp_requests: { rows: [] },
        decisions: {
          rows: [
            {
              id: "d-review-1",
              kind: "purchase_review",
              status: "pending",
              label: "Fill card on shop.example?",
              payload: {
                host: "shop.example",
                summary: "Order total $79.00 — 2 items",
                amount_band: "under $100",
                card_name: "Visa",
                card_masked: "•• 4242",
              },
            },
          ],
        },
      })
    );
    const html = await response.text();

    // The review card carries host, band, masked card — and the two
    // resolve actions the decision kinds contract requires.
    expect(html).toContain("shop.example");
    expect(html).toContain("under $100");
    expect(html).toContain("Visa");
    expect(html).toContain("approve_purchase");
    expect(html).toContain("deny_purchase");
    expect(html).toContain('value="d-review-1"');
    expect(html).toContain("Fill card");
  });

  it("renders an empty state with no pending reviews", async () => {
    const response = await vault.render(
      context({
        vault_items: { rows: [] },
        vault_managers: { rows: [] },
        vault_events: { rows: [] },
        otp_requests: { rows: [] },
        decisions: { rows: [] },
      })
    );
    const html = await response.text();
    expect(html).not.toContain("approve_purchase");
  });
});
