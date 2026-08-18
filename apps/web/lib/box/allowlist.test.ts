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

  it("allows exactly the History session surface (V8)", () => {
    expect(resolveUpstream("GET", "api/sessions/s1/messages")).toBe(
      "api_server"
    );
    expect(resolveUpstream("DELETE", "api/sessions/s1")).toBe("api_server");
  });

  it("allows channel-prefixed session ids Hermes mints (email:<thread>)", () => {
    expect(resolveUpstream("GET", "api/sessions/email:thread_123")).toBe(
      "api_server"
    );
    expect(
      resolveUpstream("GET", "api/sessions/email:thread_123/messages")
    ).toBe("api_server");
    expect(resolveUpstream("DELETE", "api/sessions/email:thread_123")).toBe(
      "api_server"
    );
    expect(resolveUpstream("GET", "api/sessions/a.b-c_d/messages")).toBe(
      "api_server"
    );
  });

  it("rejects session paths beyond the exact surface — never bulk ops", () => {
    expect(resolveUpstream("DELETE", "api/sessions")).toBe(null);
    expect(resolveUpstream("POST", "api/sessions/bulk-delete")).toBe(null);
    expect(resolveUpstream("POST", "api/sessions/import")).toBe(null);
    expect(resolveUpstream("POST", "api/sessions/prune")).toBe(null);
    expect(resolveUpstream("DELETE", "api/sessions/s1/messages")).toBe(null);
    expect(resolveUpstream("GET", "api/sessions/s1/export")).toBe(null);
    expect(resolveUpstream("GET", "api/sessions/../env")).toBe(null);
  });

  it("rejects dot-only session ids — no path-segment aliasing", () => {
    expect(resolveUpstream("GET", "api/sessions/..")).toBe(null);
    expect(resolveUpstream("GET", "api/sessions/.")).toBe(null);
    expect(resolveUpstream("DELETE", "api/sessions/..")).toBe(null);
    expect(resolveUpstream("DELETE", "api/sessions/.")).toBe(null);
    expect(resolveUpstream("GET", "api/sessions/../messages")).toBe(null);
    expect(resolveUpstream("GET", "api/sessions/:._-")).toBe(null);
  });

  it("allows exactly the Hermes jobs API surface (V3)", () => {
    expect(resolveUpstream("GET", "api/jobs")).toBe("api_server");
    expect(resolveUpstream("POST", "api/jobs")).toBe("api_server");
    expect(resolveUpstream("GET", "api/jobs/j1")).toBe("api_server");
    expect(resolveUpstream("PATCH", "api/jobs/j1")).toBe("api_server");
    expect(resolveUpstream("DELETE", "api/jobs/j1")).toBe("api_server");
    expect(resolveUpstream("POST", "api/jobs/j1/pause")).toBe("api_server");
    expect(resolveUpstream("POST", "api/jobs/j1/resume")).toBe("api_server");
    expect(resolveUpstream("POST", "api/jobs/j1/run")).toBe("api_server");
  });

  it("rejects jobs paths beyond the exact surface — never prefixes", () => {
    expect(resolveUpstream("GET", "api/jobs/j1/logs")).toBe(null);
    expect(resolveUpstream("POST", "api/jobs/j1/pause/extra")).toBe(null);
    expect(resolveUpstream("POST", "api/jobs/../env")).toBe(null);
    expect(resolveUpstream("PUT", "api/jobs/j1")).toBe(null);
  });

  it("allows exactly the profile-prefixed jobs API surface (V7)", () => {
    expect(resolveUpstream("GET", "p/researcher/api/jobs")).toBe("api_server");
    expect(resolveUpstream("POST", "p/researcher/api/jobs")).toBe("api_server");
    expect(resolveUpstream("GET", "p/researcher/api/jobs/j1")).toBe("api_server");
    expect(resolveUpstream("PATCH", "p/researcher/api/jobs/j1")).toBe(
      "api_server"
    );
    expect(resolveUpstream("DELETE", "p/researcher/api/jobs/j1")).toBe(
      "api_server"
    );
    expect(resolveUpstream("POST", "p/researcher/api/jobs/j1/pause")).toBe(
      "api_server"
    );
    expect(resolveUpstream("POST", "p/researcher/api/jobs/j1/resume")).toBe(
      "api_server"
    );
    expect(resolveUpstream("POST", "p/researcher/api/jobs/j1/run")).toBe(
      "api_server"
    );
  });

  it("rejects profile paths beyond the exact jobs surface", () => {
    expect(resolveUpstream("GET", "p/researcher/api/sessions")).toBe(null);
    expect(resolveUpstream("GET", "p/researcher/v1/skills")).toBe(null);
    expect(resolveUpstream("GET", "p/researcher/api/jobs/j1/logs")).toBe(null);
    expect(resolveUpstream("GET", "p//api/jobs")).toBe(null);
    expect(resolveUpstream("GET", "p/A/api/jobs")).toBe(null);
    expect(resolveUpstream("GET", "p/Bad_Name/api/jobs")).toBe(null);
    expect(resolveUpstream("GET", "p/../api/jobs")).toBe(null);
    expect(resolveUpstream("POST", "p/researcher/api/jobs/../env")).toBe(null);
    expect(resolveUpstream("PUT", "p/researcher/api/jobs/j1")).toBe(null);
  });

  it("rejects wrong methods on allowlisted paths", () => {
    expect(resolveUpstream("GET", "api/plugins/creative/jobs")).toBe(null);
    expect(resolveUpstream("DELETE", "api/plugins/creative/brand")).toBe(null);
    expect(resolveUpstream("POST", "api/sessions")).toBe(null);
  });
});
