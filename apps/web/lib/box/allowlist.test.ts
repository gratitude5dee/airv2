import { describe, expect, it } from "vitest";
import { resolveUpstream } from "./allowlist";

describe("resolveUpstream", () => {
  it("routes api_server paths to the api_server upstream", () => {
    expect(resolveUpstream("GET", "api/sessions")).toBe("api_server");
    expect(resolveUpstream("GET", "v1/skills")).toBe("api_server");
  });

  it("routes creative plugin paths to the dashboard upstream", () => {
    expect(resolveUpstream("POST", "api/plugins/creative/jobs")).toBe("dashboard");
    expect(resolveUpstream("GET", "api/plugins/creative/jobs/abc123")).toBe(
      "dashboard"
    );
    expect(
      resolveUpstream("POST", "api/plugins/creative/jobs/abc123/cancel")
    ).toBe("dashboard");
    expect(resolveUpstream("GET", "api/plugins/creative/assets")).toBe(
      "dashboard"
    );
    expect(
      resolveUpstream("POST", "api/plugins/creative/assets/a1/variants")
    ).toBe("dashboard");
    expect(resolveUpstream("GET", "api/plugins/creative/packages/p1")).toBe(
      "dashboard"
    );
    expect(resolveUpstream("GET", "api/plugins/creative/brand")).toBe(
      "dashboard"
    );
  });

  it("rejects asset bytes — server-to-server only, never browser-proxied", () => {
    expect(resolveUpstream("GET", "api/plugins/creative/assets/a1/bytes")).toBe(
      null
    );
  });

  it("rejects arbitrary plugin and dashboard paths", () => {
    expect(resolveUpstream("GET", "api/plugins/creative")).toBe(null);
    expect(resolveUpstream("GET", "api/plugins")).toBe(null);
    expect(resolveUpstream("GET", "api/plugins/other/jobs")).toBe(null);
    expect(resolveUpstream("POST", "api/plugins/creative/jobs/../env")).toBe(
      null
    );
    expect(resolveUpstream("GET", "api/env")).toBe(null);
    expect(resolveUpstream("PUT", "api/config")).toBe(null);
    expect(resolveUpstream("GET", "api/credentials")).toBe(null);
  });

  it("rejects wrong methods on allowlisted paths", () => {
    expect(resolveUpstream("GET", "api/plugins/creative/jobs")).toBe(null);
    expect(resolveUpstream("DELETE", "api/plugins/creative/brand")).toBe(null);
    expect(resolveUpstream("POST", "api/sessions")).toBe(null);
  });
});
