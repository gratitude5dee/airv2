/**
 * The freeze branch of buildFalZapRequest: when a caller-built plan carries
 * `plan.freeze` the submit goes to the multi-angle endpoint with the
 * camera_trajectory verbatim; anything else keeps the zap routing. A freeze
 * request without a source image fails before the queue submit.
 */
import { describe, expect, it } from "vitest";
import type { CreativeTurn } from "./gmi";
import {
  buildFalZapRequest,
  FAL_FREEZE_IMAGE_TO_VIDEO,
  FAL_ZAP_IMAGE_TO_VIDEO,
  FalRequestError,
} from "./fal";
import { directFreezePlan, getPreset } from "../miniapps/freezeRecipe";
import type { RouterPlan } from "./schema";

const IMAGE = {
  kind: "image",
  url: "https://storage.test/source.png",
} as const;

const turn: CreativeTurn = {
  text: "freeze",
  mediaInputs: [IMAGE],
};

const basePlan: RouterPlan = {
  mode: "zap",
  needs_input: false,
  chat_reply: "zapping",
  delivery_line: "here",
  expanded_prompt: "a busy crosswalk, frozen",
  params: {
    aspect_ratio: "auto",
    duration: 5,
    generate_audio: false,
    quality: "auto",
    use_input_image_as: "first_frame",
  },
};

describe("buildFalZapRequest freeze branch", () => {
  it("routes plan.freeze onto the multi-angle endpoint", () => {
    const preset = getPreset("orbit")!;
    const plan = directFreezePlan({
      trajectory: preset.trajectory,
      duration: 6,
      resolution: "1080P",
      returnsToStart: true,
      seed: 7,
    });
    const request = buildFalZapRequest(plan, turn);
    expect(request.model).toBe(FAL_FREEZE_IMAGE_TO_VIDEO);
    expect(request.input).toMatchObject({
      image_url: IMAGE.url,
      duration: 6,
      resolution: "1080P",
      prompt_expansion_mode: "balanced",
      enable_safety_checker: true,
      seed: 7,
    });
    expect(request.input["camera_trajectory"]).toEqual(preset.trajectory);
    // A copy, not the preset's frozen array.
    expect(request.input["camera_trajectory"]).not.toBe(preset.trajectory);
    expect(request.input["prompt"]).toContain("stopped time");
    expect(request.input["prompt"]).toContain(
      "Return to the exact opening camera position"
    );
  });

  it("folds an odd duration to the endpoint's 5s/6s contract", () => {
    const plan = directFreezePlan({
      trajectory: getPreset("swing")!.trajectory,
      duration: 5,
      resolution: "480P",
      returnsToStart: false,
    });
    const request = buildFalZapRequest(plan, turn);
    expect(request.input["duration"]).toBe(5);
    expect(request.input["seed"]).toBeUndefined();
  });

  it("fails before submit when the turn has no source image", () => {
    const plan = directFreezePlan({
      trajectory: getPreset("swing")!.trajectory,
      duration: 5,
      resolution: "768P",
      returnsToStart: false,
    });
    expect(() =>
      buildFalZapRequest(plan, { ...turn, mediaInputs: [] })
    ).toThrow(FalRequestError);
  });

  it("leaves ordinary zap plans on the turbo endpoint", () => {
    const request = buildFalZapRequest(basePlan, turn);
    expect(request.model).toBe(FAL_ZAP_IMAGE_TO_VIDEO);
    expect(request.input["camera_trajectory"]).toBeUndefined();
  });
});
