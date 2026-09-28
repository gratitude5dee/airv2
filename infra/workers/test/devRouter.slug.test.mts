import { describe, expect, it } from "vitest";
import { slugFromHost } from "../dev-router/index.mjs";

describe("dev-router slugFromHost", () => {
  it("parses <username>-<appname>.dev.wzrd.tech", () => {
    expect(slugFromHost("alice-blog.dev.wzrd.tech")).toBe("alice-blog");
    expect(slugFromHost("a_b-cd.dev.wzrd.tech")).toBe("a_b-cd");
  });

  it("rejects the bare apex — the empty slug fails SLUG_RE", () => {
    expect(slugFromHost("dev.wzrd.tech")).toBeNull();
  });

  it("rejects other hosts entirely", () => {
    expect(slugFromHost("app.wzrd.tech")).toBeNull();
    expect(slugFromHost("alice-blog.apps.wzrd.tech")).toBeNull();
    expect(slugFromHost("evil.dev.wzrd.tech.evil.com")).toBeNull();
    expect(slugFromHost("")).toBeNull();
  });

  it("rejects slugs the SLUG_RE grammar forbids", () => {
    // no username/app separator
    expect(slugFromHost("nosplit.dev.wzrd.tech")).toBeNull();
    // uppercase
    expect(slugFromHost("Alice-Blog.dev.wzrd.tech")).toBeNull();
    // username segment too long
    expect(slugFromHost("aaaaaaaaaaaaaaaaaaaaaaaaa-x.dev.wzrd.tech")).toBeNull();
    // trailing hyphen in app name
    expect(slugFromHost("alice-blog-.dev.wzrd.tech")).toBeNull();
  });
});
