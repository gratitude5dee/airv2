/**
 * Camera-trajectory model for the /freeze studio (ported from the reference
 * implementation's lib/recipe.ts). One trajectory is a list of 2–12
 * keyframes over normalized clip time; the fal multi-angle endpoint
 * interpolates camera position between them.
 *
 * The frozen-scene prompt is the product: it instructs the model that the
 * frame is one instant of stopped time and every apparent motion is camera
 * parallax. Presets with returnsToStart append a clause demanding the last
 * frame match the opening pose, so the render loops cleanly.
 */
import type { RouterPlan } from "../creative/schema";

export const FAL_FREEZE_IMAGE_TO_VIDEO =
  "minimax/h3-max/multi-angle/image-to-video";

export interface CameraKeyframe {
  /** 0..1 over the clip. */
  time: number;
  /** -360..360 degrees around the subject. */
  azimuth: number;
  /** -90..90 degrees. */
  elevation: number;
  /** > 0, camera radius multiplier (presets keep 1 — the prompt pins it). */
  distance: number;
}

export type FreezeResolution = "480P" | "768P" | "1080P";
export const FREEZE_RESOLUTIONS: readonly FreezeResolution[] = [
  "480P",
  "768P",
  "1080P",
];
export const FREEZE_DURATIONS = [5, 6] as const;
export type FreezeDuration = (typeof FREEZE_DURATIONS)[number];

export const FREEZE_MAX_KEYFRAMES = 12;
export const FREEZE_MIN_KEYFRAMES = 2;
const MAX_PROMPT_CHARS = 2000;

const pose = (
  time: number,
  azimuth: number,
  elevation = 0
): CameraKeyframe => ({ time, azimuth: azimuth || 0, elevation, distance: 1 });

// Full turns use nine 45° steps reaching ±360 at t≈0.833, then hold to t=1.
// Keep the signed endpoint: normalizing it to 0 would command a reverse
// orbit.
const orbit = (direction: 1 | -1): CameraKeyframe[] => [
  ...Array.from({ length: 9 }, (_, i) =>
    pose(Number(((i * 5) / 48).toFixed(6)), direction * i * 45)
  ),
  pose(1, direction * 360),
];

// Out-and-back presets return to the opening pose by t=0.8, leaving the
// final fifth as a hold for a clean loop point.
const excursion = (azimuth: number, elevation = 0): CameraKeyframe[] => [
  pose(0, 0),
  pose(0.2, azimuth / 2, elevation / 2),
  pose(0.4, azimuth, elevation),
  pose(0.6, azimuth / 2, elevation / 2),
  pose(0.8, 0),
  pose(1, 0),
];

const halo = (direction: 1 | -1): CameraKeyframe[] => [
  ...Array.from({ length: 9 }, (_, i) =>
    pose(
      Number(((i * 5) / 48).toFixed(6)),
      direction * i * 45,
      i === 8 ? 0 : Number((25 * Math.sin((Math.PI * i) / 8)).toFixed(3))
    )
  ),
  pose(1, direction * 360),
];

export type PresetId =
  | "swing"
  | "rise"
  | "orbit"
  | "orbit-left"
  | "arc-return"
  | "rise-return"
  | "arc-left-return"
  | "wide-return"
  | "dip-return"
  | "high-arc-return"
  | "low-arc-return"
  | "sway-return"
  | "halo"
  | "halo-left"
  | "arc-left"
  | "low-angle";

export interface FreezePreset {
  id: PresetId;
  name: string;
  description: string;
  duration: number;
  returnsToStart: boolean;
  trajectory: readonly CameraKeyframe[];
}

export const PRESETS: readonly FreezePreset[] = [
  {
    id: "swing",
    name: "Side Arc",
    description: "A 65-degree arc around the frame.",
    duration: 5,
    returnsToStart: false,
    trajectory: [pose(0, 0), pose(1, 65, 8)],
  },
  {
    id: "rise",
    name: "Hero Rise",
    description: "A new angle on the action.",
    duration: 5,
    returnsToStart: false,
    trajectory: [pose(0, 0), pose(1, 35, 30)],
  },
  {
    id: "orbit",
    name: "Full Orbit",
    description: "A full right orbit back to the starting pose.",
    duration: 6,
    returnsToStart: true,
    trajectory: orbit(1),
  },
  {
    id: "arc-return",
    name: "Arc Return",
    description:
      "Sweep 45 degrees to the side, then retrace to the starting pose.",
    duration: 5,
    returnsToStart: true,
    trajectory: [
      pose(0, 0),
      pose(0.2, 22.5),
      pose(0.45, 45),
      pose(0.7, 22.5),
      pose(0.9, 0),
      pose(1, 0),
    ],
  },
  {
    id: "rise-return",
    name: "Rise Return",
    description: "Rise 25 degrees, then descend to the starting pose.",
    duration: 5,
    returnsToStart: true,
    trajectory: [
      pose(0, 0),
      pose(0.2, 0, 12.5),
      pose(0.45, 0, 25),
      pose(0.7, 0, 12.5),
      pose(0.9, 0),
      pose(1, 0),
    ],
  },
  {
    id: "orbit-left",
    name: "Orbit Left",
    description: "A full left orbit back to the starting pose.",
    duration: 6,
    returnsToStart: true,
    trajectory: orbit(-1),
  },
  {
    id: "arc-left-return",
    name: "Left Return",
    description: "Sweep 45 degrees left, then retrace to the opening view.",
    duration: 5,
    returnsToStart: true,
    trajectory: excursion(-45),
  },
  {
    id: "wide-return",
    name: "Wide Return",
    description:
      "Reach a 90-degree side view, then return to the opening pose.",
    duration: 5,
    returnsToStart: true,
    trajectory: excursion(90),
  },
  {
    id: "dip-return",
    name: "Dip Return",
    description:
      "Dip 20 degrees below the subject, then rise back to the opening view.",
    duration: 5,
    returnsToStart: true,
    trajectory: excursion(0, -20),
  },
  {
    id: "high-arc-return",
    name: "High Return",
    description: "Arc 45 degrees right and 25 degrees up, then retrace home.",
    duration: 5,
    returnsToStart: true,
    trajectory: excursion(45, 25),
  },
  {
    id: "low-arc-return",
    name: "Low Return",
    description: "Arc 45 degrees left and 20 degrees down, then retrace home.",
    duration: 5,
    returnsToStart: true,
    trajectory: excursion(-45, -20),
  },
  {
    id: "sway-return",
    name: "Side to Side",
    description:
      "Sway left, cross through the opening view to the right, then return.",
    duration: 5,
    returnsToStart: true,
    trajectory: [
      pose(0, 0),
      pose(0.2, -30),
      pose(0.4, 0),
      pose(0.6, 30),
      pose(0.8, 0),
      pose(1, 0),
    ],
  },
  {
    id: "halo",
    name: "High Orbit",
    description:
      "Orbit right through a raised viewpoint, descending to the exact opening pose.",
    duration: 6,
    returnsToStart: true,
    trajectory: halo(1),
  },
  {
    id: "halo-left",
    name: "High Orbit Left",
    description:
      "Orbit left through a raised viewpoint, descending to the exact opening pose.",
    duration: 6,
    returnsToStart: true,
    trajectory: halo(-1),
  },
  {
    id: "arc-left",
    name: "Left Arc",
    description: "A 65-degree left arc that finishes at a new angle.",
    duration: 5,
    returnsToStart: false,
    trajectory: [pose(0, 0), pose(1, -65, 8)],
  },
  {
    id: "low-angle",
    name: "Low Reveal",
    description:
      "Sweep 40 degrees right and descend 20 degrees for a low-angle finish.",
    duration: 5,
    returnsToStart: false,
    trajectory: [pose(0, 0), pose(1, 40, -20)],
  },
];

export function getPreset(id: string): FreezePreset | undefined {
  return PRESETS.find((entry) => entry.id === id);
}

export const FROZEN_SCENE_PROMPT =
  "The reference image is one instant of completely stopped time, held for the entire video. Only the camera moves around this static three-dimensional scene. All people and animals remain rigid lifelike statues: preserve every face, gaze, expression, pose, hand, foot, joint and garment fold. Every object stays fixed in its reference world position, orientation and shape. Airborne objects remain suspended exactly where captured: do not travel, spin, fall or complete any implied action. Freeze hair, fabric, water, particles, foliage, shadows and background activity. Apparent screen-position changes come only from camera parallax. Begin with the exact reference framing. Follow the supplied azimuth and elevation keyframes while keeping camera radius and focal length constant. No zoom, introductory push-in or camera roll. Keep the main subject in view. Preserve identities, geometry, spatial relationships, architecture, lighting, colors and materials. One continuous shot, no cuts, no added or removed people or objects.";

const RETURN_CLAUSE =
  " Return to the exact opening camera position, viewing direction, distance, focal length and reference framing by the final hold. Finish with the same frozen scene and composition as the reference image. Hold that pose through the last frame; do not resume the action.";

/**
 * Contract check for a posted or preset trajectory (reference
 * app/api/generate/route.ts): 2–12 keyframes, time in [0,1] starting at 0
 * and ending at 1, |azimuth| ≤ 360, |elevation| ≤ 90, distance > 0, times
 * strictly increasing.
 */
export function validateTrajectory(
  value: unknown
): CameraKeyframe[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (
    value.length < FREEZE_MIN_KEYFRAMES ||
    value.length > FREEZE_MAX_KEYFRAMES
  ) {
    return undefined;
  }
  const keyframes: CameraKeyframe[] = [];
  let previousTime = -1;
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const point = entry as Record<string, unknown>;
    const { time, azimuth, elevation, distance } = point;
    if (
      typeof time !== "number" ||
      typeof azimuth !== "number" ||
      typeof elevation !== "number" ||
      typeof distance !== "number" ||
      !Number.isFinite(time) ||
      !Number.isFinite(azimuth) ||
      !Number.isFinite(elevation) ||
      !Number.isFinite(distance) ||
      time < 0 ||
      time > 1 ||
      Math.abs(azimuth) > 360 ||
      Math.abs(elevation) > 90 ||
      distance <= 0 ||
      time <= previousTime
    ) {
      return undefined;
    }
    previousTime = time;
    keyframes.push({ time, azimuth, elevation, distance });
  }
  if (keyframes[0]!.time !== 0 || keyframes[keyframes.length - 1]!.time !== 1) {
    return undefined;
  }
  return keyframes;
}

export function isFreezeResolution(value: string): value is FreezeResolution {
  return (FREEZE_RESOLUTIONS as readonly string[]).includes(value);
}

export function isFreezeDuration(value: number): value is FreezeDuration {
  return value === 5 || value === 6;
}

export function isPresetId(value: string): value is PresetId {
  return PRESETS.some((preset) => preset.id === value);
}

/**
 * The studio IS the router — the same pre-built-plan contract draw uses.
 * The fal lane reads `plan.freeze` for the multi-angle input; the prompt is
 * the frozen-scene clause plus the return-to-start hold when the preset
 * loops.
 */
export function directFreezePlan(input: {
  trajectory: readonly CameraKeyframe[];
  duration: FreezeDuration;
  resolution: FreezeResolution;
  returnsToStart: boolean;
  seed?: number | undefined;
}): RouterPlan {
  return {
    mode: "zap",
    needs_input: false,
    chat_reply: "freezing the scene and moving the camera",
    delivery_line: "here is your freeze",
    expanded_prompt: (
      FROZEN_SCENE_PROMPT + (input.returnsToStart ? RETURN_CLAUSE : "")
    ).slice(0, MAX_PROMPT_CHARS),
    params: {
      aspect_ratio: "auto",
      duration: input.duration,
      generate_audio: false,
      quality: "auto",
      use_input_image_as: "first_frame",
    },
    freeze: {
      camera_trajectory: input.trajectory,
      resolution: input.resolution,
      ...(input.seed === undefined ? {} : { seed: input.seed }),
    },
  };
}
