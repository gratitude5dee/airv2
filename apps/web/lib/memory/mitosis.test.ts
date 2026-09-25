import { describe, expect, it } from "vitest";
import { MitosisInputError, setMitosisCredentials } from "./mitosis";

// Validation rejections must throw before any box call happens. The box
// command path itself is covered in cortex.test.ts through the injected
// runner (R-TQ-10).
describe("setMitosisCredentials validation", () => {
  it("rejects a non-UUID office id", async () => {
    await expect(
      setMitosisCredentials("box", "not-a-uuid", "mi_0123456789abcdef")
    ).rejects.toBeInstanceOf(MitosisInputError);
  });

  it("rejects an api key with whitespace/newlines", async () => {
    await expect(
      setMitosisCredentials(
        "box",
        "f3259cbf-2473-4290-ba1f-f9bf378fe92f",
        "bad key\nwith newline"
      )
    ).rejects.toBeInstanceOf(MitosisInputError);
  });

  it("rejects a too-short api key", async () => {
    await expect(
      setMitosisCredentials(
        "box",
        "f3259cbf-2473-4290-ba1f-f9bf378fe92f",
        "short"
      )
    ).rejects.toBeInstanceOf(MitosisInputError);
  });
});
