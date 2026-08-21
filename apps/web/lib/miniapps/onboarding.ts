/**
 * Onboarding progress lives in the user's box at
 * `.hermes/miniapps/onboarding/state.json` (C4: no content in shared
 * Postgres) — the agent's own tools and the mini-app read and write the
 * same document. Every step is skippable and re-enterable (goal.md §MA5 #1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";

export const ONBOARDING_STEPS = [
  "username",
  "email",
  "model",
  "connect",
  "imessage",
  "onairos",
  "secrets",
  "stripe",
  "agent",
  "walkthrough",
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

function normalize(raw: unknown): OnboardingState {
  const state = defaultOnboardingState();
  if (typeof raw !== "object" || raw === null) return state;
  const doc = raw as { steps?: unknown; updated_at?: unknown };
  if (typeof doc.updated_at === "string") state.updated_at = doc.updated_at;
  if (typeof doc.steps === "object" && doc.steps !== null) {
    const steps = doc.steps as Record<string, unknown>;
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
  const box = await ensureBoxAwake(supabase, userId);
  try {
    const raw = await readFile(box.boxId, STATE_PATH);
    return normalize(JSON.parse(raw));
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
  const box = await ensureBoxAwake(supabase, userId);
  await writeFile(box.boxId, STATE_PATH, JSON.stringify(state, null, 2));
  return state;
}
