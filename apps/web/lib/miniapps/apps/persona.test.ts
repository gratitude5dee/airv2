/**
 * Persona is a read-only view: memory layers are read live only while the
 * box is already up; a sleeping box renders the empty states and is never
 * woken to draw status chips (MEM-15).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "./types";
import type { OnboardingSnapshot } from "./onboarding";

const boxes = vi.hoisted(() => ({
  peekBoxState: vi.fn<() => Promise<{ boxId: string; awake: boolean } | null>>(),
  ensureBoxAwake: vi.fn(),
  armStopAfter: vi.fn(async () => undefined),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ...boxes,
  StartLimitError: class extends Error {},
}));

const memory = vi.hoisted(() => ({
  deepMemoryStatus: vi.fn(async () => ({
    healthy: true,
    resources: 12,
    memories: 7,
    workspace_bytes: 2048,
    pending: 0,
    truncated: false,
  })),
  deepMemoryHistory: vi.fn(async () => ({ memories: [] })),
  cortexOverview: vi.fn(async () => ({
    configured: false,
    reachable: false,
    officeName: null,
    graphUrl: null,
    totals: { raw: 0, embedded: 0, entities: 0 },
    sources: [],
    recent: [],
    calls: [],
  })),
  logCortexCalls: vi.fn(async () => undefined),
}));
vi.mock("@/lib/memory/deep", () => ({
  deepMemoryStatus: memory.deepMemoryStatus,
  deepMemoryHistory: memory.deepMemoryHistory,
}));
vi.mock("@/lib/memory/cortex", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/memory/cortex")>()),
  cortexOverview: memory.cortexOverview,
  logCortexCalls: memory.logCortexCalls,
}));

const snapshot = {
  username: "gratitude",
  connections: [],
  onairos: { available: false, connected: false },
  vaultItemCount: 0,
  ingest: null,
  speedTier: null,
} as unknown as OnboardingSnapshot;
vi.mock("./onboarding", () => ({
  loadOnboardingSnapshot: vi.fn(async () => snapshot),
  effectiveStatus: () => "todo",
}));

import { persona } from "./persona";

const ctx = {
  session: { userId: "user-1", via: "web" },
  supabase: {} as SupabaseClient,
} as unknown as MiniAppContext;

async function render(): Promise<string> {
  return (await persona.render(ctx)).text();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("persona memory sections", () => {
  it("renders the asleep states without waking a stopped box", async () => {
    boxes.peekBoxState.mockResolvedValue({ boxId: "box-1", awake: false });
    const html = await render();
    expect(html).toContain("Your agent's computer is asleep");
    expect(boxes.ensureBoxAwake).not.toHaveBeenCalled();
    expect(memory.deepMemoryStatus).not.toHaveBeenCalled();
    expect(memory.cortexOverview).not.toHaveBeenCalled();
    expect(boxes.armStopAfter).not.toHaveBeenCalled();
  });

  it("renders the asleep states when the user has no box row", async () => {
    boxes.peekBoxState.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain("Your agent's computer is asleep");
    expect(memory.deepMemoryStatus).not.toHaveBeenCalled();
  });

  it("reads memory live from a box that is already awake and re-arms idle", async () => {
    boxes.peekBoxState.mockResolvedValue({ boxId: "box-1", awake: true });
    const html = await render();
    expect(memory.deepMemoryStatus).toHaveBeenCalledWith("box-1");
    expect(memory.cortexOverview).toHaveBeenCalledWith("box-1");
    expect(boxes.ensureBoxAwake).not.toHaveBeenCalled();
    expect(boxes.armStopAfter).toHaveBeenCalledWith({}, "user-1");
    expect(html).toContain("<b>12</b><span>resources</span>");
    expect(html).toContain("<b>7</b><span>memories</span>");
    expect(html).not.toContain("computer is asleep");
  });
});
