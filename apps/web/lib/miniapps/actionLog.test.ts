/**
 * The action log is a Box file appended to by two routes; the Box files API
 * has no compare-and-swap. These tests interleave two appenders against a
 * simulated Box and the 0101 lease RPCs to show the lease is what keeps
 * both entries, and that a lease never outlives its writer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const files = new Map<string, string>();
let readGate: Promise<void> | null = null;
let failWrites = false;
let failReads: Error | null = null;
const boxCalls: string[] = [];

vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1" })),
}));
vi.mock("../box/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../box/client")>();
  return {
    BoxApiError: actual.BoxApiError,
    readFile: vi.fn(async (_box: string, path: string) => {
      boxCalls.push(`read ${path}`);
      // `cat` snapshots the file when it runs; the gate stalls the response.
      const raw = files.get(path);
      if (readGate) await readGate;
      if (failReads) throw failReads;
      // The real client maps a non-zero `cat` exit to a 404.
      if (raw === undefined) throw new actual.BoxApiError(404, `readFile ${path}`);
      return raw;
    }),
    writeFile: vi.fn(async (_box: string, path: string, content: string) => {
      boxCalls.push(`write ${path}`);
      if (failWrites) throw new Error("box PUT failed");
      files.set(path, content);
    }),
  };
});

// In-memory twin of miniapp_state_lease / miniapp_state_release (0101):
// one row per (user, app, resource); take when absent, expired or already ours.
interface LeaseRow {
  holder: string;
  expiresAt: number;
}
const leases = new Map<string, LeaseRow>();
const rpcCalls: string[] = [];
let leaseError: string | null = null;

const supabase = {
  rpc: async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push(fn);
    const key = `${args["p_user_id"]}/${args["p_app"]}/${args["p_resource"]}`;
    if (fn === "miniapp_state_lease") {
      if (leaseError) return { data: null, error: { message: leaseError } };
      const row = leases.get(key);
      if (row && row.expiresAt > Date.now() && row.holder !== args["p_holder"]) {
        return { data: false, error: null };
      }
      leases.set(key, {
        holder: String(args["p_holder"]),
        expiresAt: Date.now() + Number(args["p_ttl_ms"]),
      });
      return { data: true, error: null };
    }
    if (fn === "miniapp_state_release") {
      const freed = leases.get(key)?.holder === args["p_holder"];
      if (freed) leases.delete(key);
      return { data: freed, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  },
} as unknown as SupabaseClient;

const LOG_PATH = ".hermes/miniapps/party/actions.json";
const entry = (action: string, source?: "functions") => ({
  action,
  payload: null,
  role: "owner",
  at: "2026-09-04T00:00:00.000Z",
  ...(source ? { source } : {}),
});
const log = (): { action: string }[] =>
  JSON.parse(files.get(LOG_PATH) ?? "[]") as { action: string }[];

beforeEach(() => {
  files.clear();
  leases.clear();
  boxCalls.length = 0;
  rpcCalls.length = 0;
  readGate = null;
  failWrites = false;
  failReads = null;
  leaseError = null;
});
afterEach(() => vi.restoreAllMocks());

describe("appendActionLogEntry", () => {
  it("the unleased read-modify-write drops a concurrent append (the race)", async () => {
    const { readAppState, writeAppState } = await import("./store");
    const append = async (action: string) => {
      const existing = (await readAppState(supabase, "u1", "party", "actions")) as unknown;
      const entries = Array.isArray(existing) ? (existing as unknown[]) : [];
      entries.push(entry(action));
      await writeAppState(supabase, "u1", "party", "actions", entries);
    };
    files.set(LOG_PATH, "[]");
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    const a = append("rsvp");
    const b = append("apps-api");
    open();
    await Promise.all([a, b]);
    expect(log()).toHaveLength(1);
  });

  it("leases the append so two interleaved writers both survive, in order", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    files.set(LOG_PATH, "[]");
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    // A takes the lease and blocks inside its read; B must not read yet.
    const a = appendActionLogEntry(supabase, "u1", "party", entry("rsvp", "functions"), {
      backoffMs: 5,
    });
    await vi.waitFor(() => expect(boxCalls).toContain(`read ${LOG_PATH}`));
    const b = appendActionLogEntry(supabase, "u1", "party", entry("apps-api"), {
      backoffMs: 5,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(boxCalls.filter((c) => c.startsWith("read"))).toHaveLength(1);
    expect(rpcCalls.filter((c) => c === "miniapp_state_lease").length).toBeGreaterThan(1);
    open();
    await Promise.all([a, b]);
    expect(log().map((e) => e.action)).toEqual(["rsvp", "apps-api"]);
    expect(leases.size).toBe(0);
  });

  it("many concurrent appenders all land", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        appendActionLogEntry(supabase, "u1", "party", entry(`a${i}`), {
          backoffMs: 2,
          attempts: 50,
        })
      )
    );
    expect(log()).toHaveLength(8);
    expect(new Set(log().map((e) => e.action)).size).toBe(8);
    expect(leases.size).toBe(0);
  });

  it("keeps only the newest 200 entries", async () => {
    const { appendActionLogEntry, ACTION_LOG_MAX_ENTRIES } = await import("./actionLog");
    files.set(
      LOG_PATH,
      JSON.stringify(Array.from({ length: 200 }, (_, i) => entry(`old${i}`)))
    );
    await appendActionLogEntry(supabase, "u1", "party", entry("new"));
    const entries = log();
    expect(entries).toHaveLength(ACTION_LOG_MAX_ENTRIES);
    expect(entries[0]?.action).toBe("old1");
    expect(entries.at(-1)?.action).toBe("new");
  });

  it("starts a fresh log when the file is missing or malformed", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    await appendActionLogEntry(supabase, "u1", "party", entry("first"));
    expect(log().map((e) => e.action)).toEqual(["first"]);
    files.set(LOG_PATH, '{"not":"an array"}');
    await appendActionLogEntry(supabase, "u1", "party", entry("second"));
    expect(log().map((e) => e.action)).toEqual(["second"]);
  });

  it("a failed read is not an empty log: timeouts and Box 5xx abort the append, keeping the file", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    const { BoxApiError } = await import("../box/client");
    const before = JSON.stringify(Array.from({ length: 3 }, (_, i) => entry(`kept${i}`)));
    files.set(LOG_PATH, before);
    for (const failure of [
      new BoxApiError(504, "box not ready"),
      new BoxApiError(502, "unexpected response shape"),
      Object.assign(new Error("This operation was aborted"), { name: "AbortError" }),
    ]) {
      failReads = failure;
      await expect(
        appendActionLogEntry(supabase, "u1", "party", entry("lost"), { attempts: 1 })
      ).rejects.toBe(failure);
    }
    expect(files.get(LOG_PATH)).toBe(before);
    expect(boxCalls.filter((c) => c.startsWith("write"))).toHaveLength(0);
    expect(leases.size).toBe(0);
    failReads = null;
    await appendActionLogEntry(supabase, "u1", "party", entry("after"), { attempts: 1 });
    expect(log().map((e) => e.action)).toEqual(["kept0", "kept1", "kept2", "after"]);
  });

  it("gives up with ActionLogBusyError when the lease stays held, writing nothing", async () => {
    const { appendActionLogEntry, ActionLogBusyError } = await import("./actionLog");
    leases.set("u1/party/actions", { holder: "someone-else", expiresAt: Date.now() + 60_000 });
    await expect(
      appendActionLogEntry(supabase, "u1", "party", entry("rsvp"), {
        attempts: 3,
        backoffMs: 1,
      })
    ).rejects.toBeInstanceOf(ActionLogBusyError);
    expect(rpcCalls.filter((c) => c === "miniapp_state_lease")).toHaveLength(3);
    expect(boxCalls).toHaveLength(0);
    expect(files.has(LOG_PATH)).toBe(false);
  });

  it("reclaims an expired lease left by a crashed writer", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    leases.set("u1/party/actions", { holder: "crashed", expiresAt: Date.now() - 1 });
    await appendActionLogEntry(supabase, "u1", "party", entry("rsvp"), { attempts: 1 });
    expect(log().map((e) => e.action)).toEqual(["rsvp"]);
    expect(leases.size).toBe(0);
  });

  it("releases the lease when the Box write fails, so the next writer proceeds", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    failWrites = true;
    await expect(
      appendActionLogEntry(supabase, "u1", "party", entry("rsvp"))
    ).rejects.toThrow("box PUT failed");
    expect(leases.size).toBe(0);
    failWrites = false;
    await appendActionLogEntry(supabase, "u1", "party", entry("next"), { attempts: 1 });
    expect(log().map((e) => e.action)).toEqual(["next"]);
  });

  it("aborts instead of writing when the lease expired mid-read and was re-taken", async () => {
    const { appendActionLogEntry, ActionLogBusyError } = await import("./actionLog");
    files.set(LOG_PATH, "[]");
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    // A's lease is 5ms; its read stalls past that, B takes the lease and lands.
    const a = appendActionLogEntry(supabase, "u1", "party", entry("slow"), {
      ttlMs: 5,
      attempts: 1,
    });
    await vi.waitFor(() => expect(boxCalls).toContain(`read ${LOG_PATH}`));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const bHolderBefore = leases.get("u1/party/actions")?.holder;
    const b = appendActionLogEntry(supabase, "u1", "party", entry("fast"), {
      attempts: 1,
    });
    await vi.waitFor(() =>
      expect(leases.get("u1/party/actions")?.holder).not.toBe(bHolderBefore)
    );
    open();
    await expect(a).rejects.toBeInstanceOf(ActionLogBusyError);
    await b;
    expect(log().map((e) => e.action)).toEqual(["fast"]);
    expect(boxCalls.filter((c) => c.startsWith("write"))).toHaveLength(1);
  });

  it("renews its own lease before the write so a slow read never lets it lapse", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    files.set(LOG_PATH, "[]");
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    const a = appendActionLogEntry(supabase, "u1", "party", entry("rsvp"), {
      ttlMs: 1_000,
      attempts: 1,
    });
    await vi.waitFor(() => expect(boxCalls).toContain(`read ${LOG_PATH}`));
    const before = leases.get("u1/party/actions")?.expiresAt ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 15));
    open();
    await a;
    expect(rpcCalls.filter((c) => c === "miniapp_state_lease")).toHaveLength(2);
    expect(log().map((e) => e.action)).toEqual(["rsvp"]);
    expect(leases.size).toBe(0);
    // the renewal happened after the read, i.e. it pushed the expiry out
    expect(before).toBeGreaterThan(0);
  });

  it("wakes the Box once, before the lease; only the bounded cat/PUT run inside it", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    const { ensureBoxAwake } = await import("../orchestrator/boxes");
    vi.mocked(ensureBoxAwake).mockClear();
    vi.mocked(ensureBoxAwake).mockImplementationOnce(async () => {
      expect(rpcCalls).toHaveLength(0);
      expect(boxCalls).toHaveLength(0);
      return { boxId: "box-1" } as Awaited<ReturnType<typeof ensureBoxAwake>>;
    });
    await appendActionLogEntry(supabase, "u1", "party", entry("rsvp"));
    // wake → take → cat → renew → PUT → release: no second wake anywhere inside the lease.
    expect(ensureBoxAwake).toHaveBeenCalledTimes(1);
    expect(boxCalls).toEqual([`read ${LOG_PATH}`, `write ${LOG_PATH}`]);
    expect(rpcCalls).toEqual([
      "miniapp_state_lease",
      "miniapp_state_lease",
      "miniapp_state_release",
    ]);
  });

  it("a lease RPC failure is an error, not a silent unleased write", async () => {
    const { appendActionLogEntry, ActionLogBusyError } = await import("./actionLog");
    leaseError = "connection refused";
    const failure = appendActionLogEntry(supabase, "u1", "party", entry("rsvp"));
    await expect(failure).rejects.toThrow("state lease failed");
    await expect(failure).rejects.not.toBeInstanceOf(ActionLogBusyError);
    expect(boxCalls).toHaveLength(0);
  });

  it("an unleased whole-document PUT lands between an append's read and write and is lost (the race)", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    const { writeAppState } = await import("./store");
    files.set(LOG_PATH, "[]");
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    const a = appendActionLogEntry(supabase, "u1", "party", entry("rsvp"));
    await vi.waitFor(() => expect(boxCalls).toContain(`read ${LOG_PATH}`));
    readGate = null;
    await writeAppState(supabase, "u1", "party", "actions", [entry("reset")]);
    open();
    await a;
    expect(log().map((e) => e.action)).toEqual(["rsvp"]);
  });

  it("putAppState on `actions` waits for the append lease, so neither write is interleaved", async () => {
    const { appendActionLogEntry, putAppState } = await import("./actionLog");
    files.set(LOG_PATH, "[]");
    let open!: () => void;
    readGate = new Promise((resolve) => (open = resolve));
    const a = appendActionLogEntry(supabase, "u1", "party", entry("rsvp"));
    await vi.waitFor(() => expect(boxCalls).toContain(`read ${LOG_PATH}`));
    readGate = null;
    const put = putAppState(supabase, "u1", "party", "actions", [entry("reset")]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(boxCalls.filter((c) => c.startsWith("write"))).toHaveLength(0);
    open();
    await Promise.all([a, put]);
    expect(boxCalls.filter((c) => c.startsWith("write"))).toHaveLength(2);
    expect(log().map((e) => e.action)).toEqual(["reset"]);
    expect(leases.size).toBe(0);
  });

  it("replaceActionLog gives up with ActionLogBusyError while an append holds the lease, writing nothing", async () => {
    const { replaceActionLog, ActionLogBusyError } = await import("./actionLog");
    files.set(LOG_PATH, JSON.stringify([entry("kept")]));
    leases.set("u1/party/actions", { holder: "appender", expiresAt: Date.now() + 60_000 });
    await expect(
      replaceActionLog(supabase, "u1", "party", [entry("reset")], { attempts: 2, backoffMs: 1 })
    ).rejects.toBeInstanceOf(ActionLogBusyError);
    expect(boxCalls).toHaveLength(0);
    expect(log().map((e) => e.action)).toEqual(["kept"]);
    expect(leases.get("u1/party/actions")?.holder).toBe("appender");
  });

  it("putAppState on any other resource is a plain unleased write", async () => {
    const { putAppState } = await import("./actionLog");
    await putAppState(supabase, "u1", "party", "default", { score: 7 });
    expect(files.get(".hermes/miniapps/party/default.json")).toBe(
      JSON.stringify({ score: 7 }, null, 2)
    );
    expect(rpcCalls).toHaveLength(0);
  });

  it("scopes leases per (user, app): another app's writer is never blocked", async () => {
    const { appendActionLogEntry } = await import("./actionLog");
    leases.set("u1/party/actions", { holder: "busy", expiresAt: Date.now() + 60_000 });
    await appendActionLogEntry(supabase, "u1", "other", entry("rsvp"), { attempts: 1 });
    await appendActionLogEntry(supabase, "u2", "party", entry("rsvp"), { attempts: 1 });
    expect(files.get(".hermes/miniapps/other/actions.json")).toBeDefined();
    // one take + one renewal per append, no retries against the busy row
    expect(rpcCalls.filter((c) => c === "miniapp_state_lease")).toHaveLength(4);
    expect(leases.get("u1/party/actions")?.holder).toBe("busy");
  });
});
