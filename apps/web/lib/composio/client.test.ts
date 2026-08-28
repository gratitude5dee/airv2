/**
 * No-auth toolkits (composio_search, browser_tool, …) have no hosted Connect
 * flow — the link endpoint 400s on them (code 4326), so the catalog must
 * never offer them for connection.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: { composioApiKey: () => "test-key" },
}));

import { listToolkits } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listToolkits", () => {
  it("filters out no-auth toolkits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            items: [
              { slug: "gmail", name: "Gmail", no_auth: false },
              { slug: "composio_search", name: "Composio Search", no_auth: true },
              { slug: "notion", name: "Notion" },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const toolkits = await listToolkits();
    expect(toolkits.map((t) => t.slug)).toEqual(["gmail", "notion"]);
  });
});
