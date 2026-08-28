/**
 * Onboarding progress lives in the user's box at
 * `.hermes/miniapps/onboarding/state.json` (C4: no content in shared
 * Postgres) — the agent's own tools and the mini-app read and write the
 * same document. Every step is skippable and re-enterable (goal.md §MA5 #1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureComputeAwake } from "../compute/awake";
import { readComputeFile, writeComputeFile } from "../compute/runtime";
import { asRecord } from "../records";

export const ONBOARDING_STEPS = [
  "environment",
  "username",
  "email",
  "model",
  "selfies",
  "twin",
  "avatar",
  "imessage",
  "onairos",
  "connect",
  "secrets",
  "stripe",
  "link",
  "agent",
  "walkthrough",
  "import",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export type OnboardingStepStatus = "todo" | "done" | "skipped";

export interface OnboardingState {
  steps: Record<OnboardingStepId, OnboardingStepStatus>;
  updated_at: string | null;
}

const STATE_PATH = ".hermes/miniapps/onboarding/state.json";

export function isOnboardingStep(value: string): value is OnboardingStepId {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function defaultOnboardingState(): OnboardingState {
  const steps = {} as Record<OnboardingStepId, OnboardingStepStatus>;
  for (const step of ONBOARDING_STEPS) steps[step] = "todo";
  return { steps, updated_at: null };
}

export function normalizeOnboardingState(raw: unknown): OnboardingState {
  const state = defaultOnboardingState();
  if (typeof raw !== "object" || raw === null) return state;
  const doc = raw as { steps?: unknown; updated_at?: unknown };
  if (typeof doc.updated_at === "string") state.updated_at = doc.updated_at;
  const steps = asRecord(doc.steps);
  if (steps) {
    for (const step of ONBOARDING_STEPS) {
      const value = steps[step];
      if (value === "done" || value === "skipped" || value === "todo") {
        state.steps[step] = value;
      }
    }
  }
  return state;
}

export async function readOnboardingState(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingState> {
  const target = await ensureComputeAwake(supabase, userId);
  try {
    const raw = await readComputeFile(target, STATE_PATH);
    return normalizeOnboardingState(JSON.parse(raw));
  } catch {
    return defaultOnboardingState();
  }
}

export async function markOnboardingStep(
  supabase: SupabaseClient,
  userId: string,
  step: OnboardingStepId,
  status: OnboardingStepStatus
): Promise<OnboardingState> {
  const state = await readOnboardingState(supabase, userId);
  state.steps[step] = status;
  state.updated_at = new Date().toISOString();
  const target = await ensureComputeAwake(supabase, userId);
  await writeComputeFile(target, STATE_PATH, JSON.stringify(state, null, 2));
  return state;
}
