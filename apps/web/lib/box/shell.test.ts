import { describe, expect, it } from "vitest";
import { shellQuote } from "./shell";

describe("shellQuote", () => {
  it("wraps plain values in single quotes", () => {
    expect(shellQuote("/home/user/.hermes/inbox/photo.jpg")).toBe(
      "'/home/user/.hermes/inbox/photo.jpg'"
    );
  });

  it("neutralizes double-quote expansion vectors", () => {
    expect(shellQuote("$(rm -rf /)")).toBe("'$(rm -rf /)'");
    expect(shellQuote("`id`")).toBe("'`id`'");
    expect(shellQuote("$HOME")).toBe("'$HOME'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellQuote("a'b")).toBe("'a'\\''b'");
    expect(shellQuote("''")).toBe("''\\'''\\'''");
  });
});
