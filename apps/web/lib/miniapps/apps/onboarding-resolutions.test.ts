/**
 * iMessage onboarding step: the owner's decision list for legacy chat labels
 * the archive migration could not settle. Labels and candidate IDs are
 * content — they render only on this owner-session slide straight from the
 * Box; Postgres (the status mirror) carries a count at most, and a sleeping
 * computer is never woken to fetch them.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";
import type { IngestStatus } from "@/lib/imessage/ingest";
import type { ResolutionView } from "@/lib/imessage/archiveResolutions";

const boxFiles = new Map<string, string>();
const mirrorRows: Array<Record<string, unknown>> = [];
const logs: string[] = [];
const ensureBoxAwake = vi.fn(async () => ({ boxId: "box-1", target: "target-1" }));
const readIngestStatus = vi.fn<() => Promise<IngestStatus>>();
const readResolutionView = vi.fn<() => Promise<ResolutionView>>();
const saveResolutions = vi.fn<(...args: unknown[]) => Promise<ResolutionView>>();

vi.mock("@/lib/box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new Error("not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
  command: vi.fn(),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: (...args: unknown[]) => ensureBoxAwake(...(args as [])),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));
vi.mock("@/lib/vault/managers", () => ({
  listManagers: vi.fn(async () => []),
  enableManager: vi.fn(),
  ManagerInputError: class extends Error {},
}));
vi.mock("@/lib/imessage/ingest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/imessage/ingest")>()),
  mintIngestTicket: vi.fn(() => "ticket"),
  readIngestStatus: (...args: unknown[]) => readIngestStatus(...(args as [])),
}));
vi.mock("@/lib/imessage/archiveResolutions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/imessage/archiveResolutions")>()),
  readResolutionView: (...args: unknown[]) => readResolutionView(...(args as [])),
  saveResolutions: (...args: unknown[]) => saveResolutions(...args),
}));
vi.mock("@/lib/commerce/merchants", () => ({
  getMerchant: vi.fn(async () => null),
  startOnboarding: vi.fn(),
}));
vi.mock("@/lib/connectors/manage", () => ({
  TOOLKIT_SLUG_PATTERN: /^[a-z0-9_-]{1,64}$/,
  beginConnect: vi.fn(),
  syncConnections: vi.fn(async () => []),
}));
vi.mock("@/lib/onairos/sync", () => ({
  syncOnairos: vi.fn(),
  onairosStatus: vi.fn(async () => ({
    configured: false,
    status: "disconnected" as const,
    connectedAt: null,
  })),
}));
vi.mock("@/lib/miniapps/cards", () => ({
  sendMiniAppCard: vi.fn(async () => undefined),
}));
vi.mock("@/lib/miniapps/cardSends", () => ({
  claimCardSend: vi.fn(async () => null),
}));

import { onboarding } from "@/lib/miniapps/apps/onboarding";
import { ResolutionInputError } from "@/lib/imessage/archiveResolutions";
import { StateBusyError } from "@/lib/miniapps/stateLease";

const LABEL_A = "Book club <friends> & co";
const LABEL_B = "Unknown sender canary-7f3a";
const CANDIDATE_A1 = "chat-book-1";
const CANDIDATE_A2 = "chat-book-2";
const CANARIES = [LABEL_A, LABEL_B, CANDIDATE_A1, CANDIDATE_A2, "canary-7f3a", "Book club"];

const status = (pending: number): IngestStatus => ({
  chunks: 2,
  messages: 40,
  last_upload_at: "2026-09-01T00:00:01.000Z",
  from_date: "2026-08-01T00:00:00Z",
  to_date: "2026-09-01T00:00:00Z",
  cursor: "2026-09-01T00:00:00.000Z",
  pending_resolutions: pending,
});
const view = (unresolved: ResolutionView["unresolved"], resolutions: ResolutionView["resolutions"] = []): ResolutionView => ({
  unresolved,
  reported_at: "2026-09-01T00:00:02.000Z",
  resolutions,
});
const pendingView = () => view([
  { label: LABEL_A, candidates: [CANDIDATE_A1, CANDIDATE_A2] },
  { label: LABEL_B, candidates: [] },
]);

function thenable(rows: unknown, single: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "is", "order", "limit", "gte", "lt"]) {
    builder[method] = vi.fn(chain);
  }
  builder["upsert"] = vi.fn((row: Record<string, unknown>) => {
    mirrorRows.push(row);
    return builder;
  });
  builder["maybeSingle"] = async () => ({ data: single, error: null });
  builder["then"] = (resolve: (value: { data: unknown; count: number }) => unknown) =>
    Promise.resolve({ data: rows, count: 0 }).then(resolve);
  return builder;
}

function makeCtx(options: { boxState?: string; mirror?: Record<string, unknown> | null } = {}) {
  const tables: Record<string, ReturnType<typeof thenable>> = {
    users: thenable([], { username: "grat" }),
    agent_addresses: thenable([], { address: "grat@wzrd.tech" }),
    connections: thenable([]),
    vault_items: thenable([]),
    entitlements: thenable([], { speed_tier: "balanced" }),
    plugin_tokens: thenable([]),
    boxes: thenable([], {
      provider_box_id: "box-1",
      environment: "ubuntu",
      control_url: null,
      control_token: null,
      state: options.boxState ?? "ready",
    }),
    onboarding_status_mirror: thenable([], options.mirror ?? null),
    imessage_destinations: thenable([], null),
  };
  return {
    request: new NextRequest("https://mini.example/mini/setup?step=imessage"),
    supabase: { from: (table: string) => tables[table] ?? thenable([]) } as unknown as SupabaseClient,
    app: makeApp({ slug: "setup", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

const freshMirror = (pending: number) => ({
  state: { steps: {}, updated_at: null },
  ingest: status(pending),
  imports: null,
  browser_profile: null,
  link: null,
  refreshed_at: new Date().toISOString(),
});

function expectNoContentLeaked() {
  const persisted = JSON.stringify(mirrorRows) + JSON.stringify(boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "") + logs.join("\n");
  for (const canary of CANARIES) expect(persisted).not.toContain(canary);
}

const spies = [
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(" ")); }),
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(" ")); }),
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(" ")); }),
];

afterEach(() => {
  boxFiles.clear();
  mirrorRows.length = 0;
  logs.length = 0;
  ensureBoxAwake.mockClear();
  readIngestStatus.mockReset();
  readResolutionView.mockReset();
  saveResolutions.mockReset();
  for (const spy of spies) spy.mockClear();
});

describe("onboarding iMessage step: legacy label resolution", () => {
  it("renders nothing about resolutions when the box reports none pending", async () => {
    readIngestStatus.mockResolvedValue(status(0));
    const body = await (await onboarding.render(makeCtx())).text();
    expect(body).not.toContain("resolve_threads");
    expect(body).not.toContain("earlier chat label");
    expect(readResolutionView).not.toHaveBeenCalled();
  });

  it("lists each pending label with its candidates or the no-match option, escaped, on the owner slide only", async () => {
    readIngestStatus.mockResolvedValue(status(2));
    readResolutionView.mockResolvedValue(pendingView());
    const body = await (await onboarding.render(makeCtx())).text();
    expect(readResolutionView).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(body).toContain("<strong>2</strong> earlier chat labels");
    expect(body).toContain('value="resolve_threads"');
    expect(body).toContain("Book club &lt;friends&gt; &amp; co");
    expect(body).not.toContain(LABEL_A);
    expect(body).toContain(`<option value="${CANDIDATE_A1}">${CANDIDATE_A1}</option>`);
    expect(body).toContain(`<option value="${CANDIDATE_A2}">${CANDIDATE_A2}</option>`);
    expect(body).toContain('<select name="id_0"><option value="chat-book-1">');
    expect(body).toContain('<option value="">Keep as its own thread</option>');
    expect(body).toContain(`<input type="hidden" name="label_1" value="${LABEL_B}"><select name="id_1"><option value="">No match — keep as its own thread</option></select>`);
    expect(body).toContain("rerun the upload command");
    expect(mirrorRows.length).toBeGreaterThan(0);
    expect(JSON.stringify(mirrorRows)).toContain('"pending_resolutions":2');
    expectNoContentLeaked();
  });

  it("does not wake a sleeping box for the labels: the mirrored count renders an asleep state with Refresh", async () => {
    const body = await (await onboarding.render(makeCtx({ boxState: "stopped", mirror: freshMirror(3) }))).text();
    expect(body).toContain("<strong>3</strong> earlier chat labels");
    expect(body).toContain("computer is asleep");
    expect(body).toContain('value="refresh_ingest"');
    expect(body).not.toContain("resolve_threads");
    expect(readResolutionView).not.toHaveBeenCalled();
    expect(readIngestStatus).not.toHaveBeenCalled();
    expect(ensureBoxAwake).not.toHaveBeenCalled();
    expectNoContentLeaked();
  });

  it("reads the labels live when the mirror says pending and the box is already awake", async () => {
    readResolutionView.mockResolvedValue(pendingView());
    const body = await (await onboarding.render(makeCtx({ boxState: "idle", mirror: freshMirror(2) }))).text();
    expect(readResolutionView).toHaveBeenCalledOnce();
    expect(body).toContain("Book club &lt;friends&gt; &amp; co");
    expect(body).not.toContain("computer is asleep");
    expect(mirrorRows).toEqual([]);
    expectNoContentLeaked();
  });

  it("resolve_threads posts every decision through saveResolutions untouched and reports the remaining count", async () => {
    readIngestStatus.mockResolvedValue(status(1));
    saveResolutions.mockResolvedValue(view([{ label: LABEL_B, candidates: [] }], [{ label: LABEL_A, id: CANDIDATE_A2 }]));
    readResolutionView.mockResolvedValue(view([{ label: LABEL_B, candidates: [] }], [{ label: LABEL_A, id: CANDIDATE_A2 }]));
    const form = new FormData();
    form.set("action", "resolve_threads");
    form.set("label_0", LABEL_A);
    form.set("id_0", CANDIDATE_A2);
    form.set("label_1", "  Stray label the owner did not decide ");
    form.set("id_1", "");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(saveResolutions).toHaveBeenCalledWith(expect.anything(), "user-1", {
      resolutions: [
        { label: LABEL_A, id: CANDIDATE_A2 },
        { label: "  Stray label the owner did not decide ", id: null },
      ],
    });
    const body = await response.text();
    expect(body).toContain("Saved. 1 label still needs a decision; rerun the upload command once all are decided.");
    expect(body).toContain('name="label_0" value="Unknown sender canary-7f3a"');
    expect(body).not.toContain("Stray label");
    expectNoContentLeaked();
  });

  it("tells the owner to rerun the upload once every label is decided", async () => {
    readIngestStatus.mockResolvedValue(status(2));
    saveResolutions.mockResolvedValue(view([], [{ label: LABEL_A, id: CANDIDATE_A1 }, { label: LABEL_B, id: null }]));
    readResolutionView.mockResolvedValue(view([], [{ label: LABEL_A, id: CANDIDATE_A1 }, { label: LABEL_B, id: null }]));
    const form = new FormData();
    form.set("action", "resolve_threads");
    form.set("label_0", LABEL_A);
    form.set("id_0", CANDIDATE_A1);
    form.set("label_1", LABEL_B);
    form.set("id_1", "");
    const body = await (await onboarding.action!(makeCtx(), form)).text();
    expect(body).toContain("Saved — every label is decided. Rerun the upload command on your Mac to finish.");
    expect(body).toContain("All earlier chat labels are decided (2 saved). Rerun the upload command below to finish.");
    expect(body).not.toContain("resolve_threads");
    expectNoContentLeaked();
  });

  it("surfaces validation and busy failures as notices without echoing the submitted labels", async () => {
    readIngestStatus.mockResolvedValue(status(0));
    const form = new FormData();
    form.set("action", "resolve_threads");
    form.set("label_0", LABEL_A);
    form.set("id_0", "not-a-candidate");
    saveResolutions.mockRejectedValueOnce(new ResolutionInputError("Unknown candidate for a pending label"));
    let body = await (await onboarding.action!(makeCtx(), form)).text();
    expect(body).toContain("Couldn't save: Unknown candidate for a pending label. Tap Refresh status and try again.");
    expect(body).not.toContain("not-a-candidate");
    saveResolutions.mockRejectedValueOnce(new StateBusyError());
    body = await (await onboarding.action!(makeCtx(), form)).text();
    expect(body).toContain("An upload is writing to your archive right now");
    expectNoContentLeaked();
  });
});
