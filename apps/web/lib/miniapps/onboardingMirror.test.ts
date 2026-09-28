/**
 * The mirror row must carry status metadata only — in particular the Link
 * pairing phrase and verification URL must never reach Postgres (C4).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";

vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "target-1" })),
  peekBoxState: vi.fn(async () => ({ boxId: "box-1", awake: false })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));
vi.mock("../box/client", () => ({
  readFile: vi.fn(async () => {
    throw new Error("not found");
  }),
  writeFile: vi.fn(async () => undefined),
  command: vi.fn(),
}));

import { ensureBoxAwake, peekBoxState, StartLimitError } from "../orchestrator/boxes";
import { readFile } from "../box/client";
import { ensureComputeAwake } from "../compute/awake";
import { expectLog } from "../testing/expectLog";
import {
  readImportStatusOrMirror,
  readIngestStatusOrMirror,
  readStatusMirror,
  refreshStatusMirror,
  refreshStatusMirrorIfAwake,
  toLinkMeta,
  writeStatusMirror,
} from "./onboardingMirror";

vi.mock("../compute/awake", () => ({
  ensureComputeAwake: vi.fn(async () => ({ kind: "box", boxId: "box-1" })),
}));

function fakeSupabase(row: Record<string, unknown> | null) {
  const db = new FakeSupabase();
  if (row !== null) {
    db.tables["onboarding_status_mirror"] = [{ user_id: "user-1", ...row }];
  }
  return { supabase: db.client(), db };
}

describe("toLinkMeta", () => {
  it("keeps booleans and timestamps, drops phrase and URL", () => {
    const meta = toLinkMeta({
      installed: true,
      session_authenticated: false,
      agent_payment_grant: "unknown",
      authenticated: false,
      verification_url: "https://app.link.com/device/setup?code=a-b-c",
      phrase: "a-b-c",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(meta).toEqual({
      installed: true,
      session_authenticated: false,
      agent_payment_grant: "unknown",
      authenticated: false,
      pairing: true,
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(JSON.stringify(meta)).not.toContain("a-b-c");
  });

  it("pairing is false when no phrase or URL exists", () => {
    const meta = toLinkMeta({
      installed: true,
      session_authenticated: true,
      agent_payment_grant: "ready",
      authenticated: true,
      verification_url: null,
      phrase: null,
      updated_at: null,
    });
    expect(meta.pairing).toBe(false);
  });
});

describe("writeStatusMirror", () => {
  it("persists only the safe link meta, never the phrase", async () => {
    const { supabase, db } = fakeSupabase(null);
    await writeStatusMirror(supabase, "user-1", {
      link: {
        installed: true,
        session_authenticated: false,
        agent_payment_grant: "unknown",
        authenticated: false,
        verification_url: "https://app.link.com/device/setup?code=q-r-s",
        phrase: "q-r-s",
        updated_at: null,
      },
    });
    expect(db.upserts).toHaveLength(1);
    expect(JSON.stringify(db.upserts[0]?.row)).not.toContain("q-r-s");
    expect(db.upserts[0]?.row["link"]).toMatchObject({
      installed: true,
      authenticated: false,
      pairing: true,
    });
  });

  it("swallows write failures", async () => {
    const { supabase, db } = fakeSupabase(null);
    db.errors["onboarding_status_mirror"] = { message: "boom" };
    await expect(
      writeStatusMirror(supabase, "user-1", { ingest: null })
    ).resolves.toBeUndefined();
    expectLog(/onboarding\ mirror\ write\ failed/, { level: "error" });
  });
});

describe("readStatusMirror", () => {
  it("returns null when no row exists", async () => {
    const { supabase } = fakeSupabase(null);
    expect(await readStatusMirror(supabase, "user-1")).toBeNull();
  });

  it("normalizes stored columns", async () => {
    const { supabase } = fakeSupabase({
      state: { steps: { username: "done" }, updated_at: "2026-01-01" },
      ingest: { chunks: 3, messages: 42 },
      imports: null,
      browser_profile: null,
      link: { installed: true, authenticated: true },
      refreshed_at: "2026-01-02T00:00:00Z",
    });
    const mirror = await readStatusMirror(supabase, "user-1");
    expect(mirror?.state?.steps.username).toBe("done");
    expect(mirror?.state?.steps.email).toBe("todo");
    expect(mirror?.ingest?.chunks).toBe(3);
    expect(mirror?.imports).toBeNull();
    expect(mirror?.link).toEqual({
      installed: true,
      session_authenticated: true,
      agent_payment_grant: "unknown",
      authenticated: false,
      pairing: false,
      updated_at: null,
    });
    expect(mirror?.refreshedAt).toBe("2026-01-02T00:00:00Z");
  });
});

describe("mirror-aware status reads (MEM-15)", () => {
  const ingestRow = {
    state: null,
    ingest: { chunks: 3, messages: 42, cursor: "2026-01-01T00:00:00.000Z" },
    imports: { last_upload_at: "2026-01-01T00:00:00Z" },
    browser_profile: null,
    link: null,
    refreshed_at: "2026-01-02T00:00:00Z",
  };
  beforeEach(() => vi.clearAllMocks());

  it("serves a sleeping box from the mirror without waking it", async () => {
    vi.mocked(peekBoxState).mockResolvedValueOnce({ boxId: "box-1", awake: false });
    const { supabase, db } = fakeSupabase(ingestRow);
    const read = await readIngestStatusOrMirror(supabase, "user-1");
    expect(read.source).toBe("mirror");
    expect(read.status?.chunks).toBe(3);
    expect(read.status?.cursor).toBe("2026-01-01T00:00:00.000Z");
    expect(read.refreshedAt).toBe("2026-01-02T00:00:00Z");
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
    expect(db.upserts).toHaveLength(0);
  });

  it("reports a null status when the box sleeps and no mirror row exists", async () => {
    vi.mocked(peekBoxState).mockResolvedValueOnce(null);
    const { supabase } = fakeSupabase(null);
    const read = await readImportStatusOrMirror(supabase, "user-1");
    expect(read).toEqual({ status: null, source: "mirror", refreshedAt: null });
    expect(ensureBoxAwake).not.toHaveBeenCalled();
  });

  it("reads live and refreshes the mirror when the box is already awake", async () => {
    vi.mocked(peekBoxState).mockResolvedValueOnce({ boxId: "box-1", awake: true });
    vi.mocked(readFile).mockResolvedValueOnce(
      JSON.stringify({ chunks: 9, messages: 100, cursor: null })
    );
    const { supabase, db } = fakeSupabase(ingestRow);
    const read = await readIngestStatusOrMirror(supabase, "user-1");
    expect(read.source).toBe("live");
    expect(read.status?.chunks).toBe(9);
    expect(ensureBoxAwake).toHaveBeenCalledTimes(1);
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0]?.row["ingest"]).toMatchObject({ chunks: 9 });
  });

  it("live import reads refresh the imports column", async () => {
    vi.mocked(peekBoxState).mockResolvedValueOnce({ boxId: "box-1", awake: true });
    vi.mocked(readFile).mockResolvedValueOnce(
      JSON.stringify({ last_upload_at: "2026-03-01T00:00:00Z" })
    );
    const { supabase, db } = fakeSupabase(null);
    const read = await readImportStatusOrMirror(supabase, "user-1");
    expect(read.source).toBe("live");
    expect(read.status?.last_upload_at).toBe("2026-03-01T00:00:00Z");
    expect(db.upserts[0]?.row["imports"]).toMatchObject({
      last_upload_at: "2026-03-01T00:00:00Z",
    });
  });
});

describe("refreshStatusMirror", () => {
  it("reads live docs and backfills the row", async () => {
    const { supabase, db } = fakeSupabase(null);
    const live = await refreshStatusMirror(supabase, "user-1");
    expect(live.boxBusy).toBe(false);
    expect(live.state.steps.username).toBe("todo");
    expect(db.upserts).toHaveLength(1);
    expect(Object.keys(db.upserts[0]?.row ?? {})).toEqual(
      expect.arrayContaining(["state", "ingest", "imports", "browser_profile", "link"])
    );
  });

  it("skips the row write while the box is starting", async () => {
    vi.mocked(ensureComputeAwake).mockRejectedValueOnce(new StartLimitError());
    const { supabase, db } = fakeSupabase(null);
    const live = await refreshStatusMirror(supabase, "user-1");
    expect(live.boxBusy).toBe(true);
    expect(db.upserts).toHaveLength(0);
  });
});

describe("refreshStatusMirrorIfAwake", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves a sleeping box asleep and reads nothing", async () => {
    vi.mocked(peekBoxState).mockResolvedValueOnce({ boxId: "box-1", awake: false });
    const { supabase, db } = fakeSupabase(null);
    const live = await refreshStatusMirrorIfAwake(supabase, "user-1");
    expect(live).toBeNull();
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expect(ensureComputeAwake).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
    expect(db.upserts).toHaveLength(0);
  });

  it("skips users without a box", async () => {
    vi.mocked(peekBoxState).mockResolvedValueOnce(null);
    const { supabase, db } = fakeSupabase(null);
    expect(await refreshStatusMirrorIfAwake(supabase, "user-1")).toBeNull();
    expect(ensureComputeAwake).not.toHaveBeenCalled();
    expect(db.upserts).toHaveLength(0);
  });

  it("refreshes the row from a box that is already awake", async () => {
    vi.mocked(peekBoxState).mockResolvedValueOnce({ boxId: "box-1", awake: true });
    const { supabase, db } = fakeSupabase(null);
    const live = await refreshStatusMirrorIfAwake(supabase, "user-1");
    expect(live?.boxBusy).toBe(false);
    expect(db.upserts).toHaveLength(1);
  });
});
