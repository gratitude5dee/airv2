import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "../box/client";
import { createRun, runEvents } from "../hermes/client";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { hermesDeltas } from "../orchestrator/flush";
import type { AgentSchedule } from "./schedule";
import { runSchedule } from "./sweep";

vi.mock("../box/client", () => ({ command: vi.fn(), readFile: vi.fn() }));
vi.mock("../hermes/client", () => ({
  createRun: vi.fn(),
  runEvents: vi.fn(),
  MAIN_SESSION: "air-main",
}));
vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(),
  armStopAfter: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../orchestrator/flush", () => ({ hermesDeltas: vi.fn() }));

afterEach(() => vi.useRealTimers());

describe("scheduled run duration", () => {
  it("excludes waking the box and loading the prompt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T10:00:00Z"));
    vi.mocked(ensureBoxAwake).mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-09-10T10:01:30Z"));
      return {
        boxId: "box-test",
        target: {
          hostedUrl: "https://box.test",
          hostedToken: "",
          apiServerKey: "test",
        },
      };
    });
    vi.mocked(readFile).mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-09-10T10:01:35Z"));
      return "test prompt";
    });
    vi.mocked(createRun).mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-09-10T10:01:37Z"));
      return { run_id: "run-test" };
    });
    vi.mocked(runEvents).mockResolvedValue(new ReadableStream<Uint8Array>());
    vi.mocked(hermesDeltas).mockImplementation(async function* () {
      vi.setSystemTime(new Date("2026-09-10T10:01:47Z"));
      yield "completed";
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: () => ({
        insert,
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    } as unknown as SupabaseClient;
    const schedule: AgentSchedule = {
      id: "schedule-test",
      user_id: "user-test",
      name: "Test",
      cron: "0 9 * * *",
      timezone: "UTC",
      prompt_ref: ".hermes/schedules/test.md",
      deliver: "none",
      source: "calendar",
      status: "active",
      next_run_at: "2026-09-10T10:00:00Z",
      last_run_at: null,
      failure_count: 0,
      one_shot: false,
    };

    await runSchedule(supabase, schedule);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        started_at: "2026-09-10T10:01:37.000Z",
        ended_at: "2026-09-10T10:01:47.000Z",
        box_seconds: 10,
      })
    );
  });
});
