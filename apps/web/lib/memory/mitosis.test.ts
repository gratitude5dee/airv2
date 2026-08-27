import { describe, expect, it } from "vitest";
import { MitosisInputError, setMitosisCredentials } from "./mitosis";

// Only the validation layer is testable here — anything past it talks to a
// box. Rejections must throw before any box call happens.
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
