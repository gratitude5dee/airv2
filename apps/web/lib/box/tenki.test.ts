import {
  CommandTimeoutError,
  QuotaExceededError,
  SessionNotFoundError,
  type ExposedPort,
  type Session,
  type SessionState,
  type Snapshot,
  type SnapshotState,
  type TenkiSandbox,
} from "@tenkicloud/sandbox";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoxApiError } from "./types";
import {
  ROUTE_RENEW_BEFORE_MS,
  ROUTE_TTL_MS,
  STOP_WAIT_MS,
  TENKI_BOX_SHAPE,
  TENKI_TAG_MAX_LENGTH,
  boxTag,
  command,
  deleteBox,
  fork,
  getBox,
  hostRoute,
  isTenkiBoxId,
  isTenkiTemplateRef,
  mapSessionState,
  newBoxKey,
  resume,
  routeIsFresh,
  setTenkiClientForTests,
  stop,
  toBoxApiError,
  toBoxId,
  toBoxKey,
  toSnapshotId,
  userCommand,
  writeFile,
  writeFileCommand,
} from "./tenki";

interface FakeSession {
  id: string;
  state: SessionState;
  cpuCores: number;
  memoryMb: number;
  tags: string[];
  sourceSnapshotId: string | undefined;
  exec: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  listExposedPorts: ReturnType<typeof vi.fn>;
  exposePort: ReturnType<typeof vi.fn>;
  unexposePort: ReturnType<typeof vi.fn>;
}

const BOX = "tk_box-1";

function fakeSession(
  state: SessionState = "RUNNING",
  overrides: Partial<Pick<FakeSession, "id" | "tags" | "sourceSnapshotId">> = {}
): FakeSession {
  const session: FakeSession = {
    id: "sess-1",
    state,
    cpuCores: 4,
    memoryMb: 8192,
    tags: [boxTag(BOX)],
    sourceSnapshotId: undefined,
    exec: vi.fn(),
    refresh: vi.fn(async () => undefined),
    close: vi.fn(async () => {
      session.state = "TERMINATED";
    }),
    listExposedPorts: vi.fn(async () => []),
    exposePort: vi.fn(),
    unexposePort: vi.fn(async () => undefined),
    ...overrides,
  };
  return session;
}

function fakeSnapshot(
  id: string,
  state: SnapshotState,
  extra: Partial<Snapshot> = {}
): Snapshot {
  return {
    id,
    name: `air-box-box-1`,
    state,
    sessionId: "sess-1",
    tags: [boxTag(BOX)],
    cpuCores: 4,
    memoryMb: 8192,
    diskSizeGb: 40,
    createdAt: new Date(0),
    ...extra,
  } as Snapshot;
}

/**
 * An in-memory provider: sessions and snapshots are looked up by tag, exactly
 * as the adapter does, so the tests exercise the real resolution path.
 */
interface FakeClient {
  sessions: FakeSession[];
  snapshots: Snapshot[];
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  updateSession: ReturnType<typeof vi.fn>;
  listSnapshots: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
  createSnapshotAsync: ReturnType<typeof vi.fn>;
  updateSnapshot: ReturnType<typeof vi.fn>;
  waitSnapshotReady: ReturnType<typeof vi.fn>;
  deleteSnapshot: ReturnType<typeof vi.fn>;
}

function install(
  sessions: FakeSession[] = [],
  snapshots: Snapshot[] = []
): FakeClient {
  const client: FakeClient = {
    sessions,
    snapshots,
    create: vi.fn(async (options: { tags?: string[]; snapshotId?: string }) => {
      const created = fakeSession("CREATING", {
        id: `sess-${sessions.length + 1}`,
        tags: options.tags ?? [],
        sourceSnapshotId: options.snapshotId,
      });
      sessions.push(created);
      return created;
    }),
    get: vi.fn(async (id: string) => {
      const found = sessions.find((session) => session.id === id);
      if (!found) throw new SessionNotFoundError(id);
      return found;
    }),
    list: vi.fn(async (options: { tags?: string[] }) =>
      sessions.filter(
        (session) =>
          session.state !== "TERMINATED" &&
          (options.tags ?? []).every((tag) => session.tags.includes(tag))
      )
    ),
    updateSession: vi.fn(async (id: string) =>
      sessions.find((session) => session.id === id)
    ),
    listSnapshots: vi.fn(async () => [...snapshots]),
    getSnapshot: vi.fn(async (id: string) => {
      const found = snapshots.find((snapshot) => snapshot.id === id);
      if (!found) throw new SessionNotFoundError(id);
      return found;
    }),
    createSnapshotAsync: vi.fn(async (sessionId: string, options: { name: string }) => {
      const created = fakeSnapshot(`snap-${snapshots.length + 1}`, "CREATING", {
        sessionId,
        name: options.name,
        tags: [],
        createdAt: new Date(snapshots.length + 1),
      });
      snapshots.push(created);
      return created;
    }),
    updateSnapshot: vi.fn(async (id: string, options: { tags?: string[] }) => {
      const found = snapshots.find((snapshot) => snapshot.id === id);
      if (!found) throw new SessionNotFoundError(id);
      if (options.tags) found.tags = options.tags;
      return found;
    }),
    waitSnapshotReady: vi.fn(async (id: string) => {
      const found = snapshots.find((snapshot) => snapshot.id === id);
      if (found) found.state = "READY";
      return found;
    }),
    deleteSnapshot: vi.fn(async (id: string) => {
      const index = snapshots.findIndex((snapshot) => snapshot.id === id);
      if (index >= 0) snapshots.splice(index, 1);
    }),
  };
  setTenkiClientForTests(client as unknown as TenkiSandbox);
  return client;
}

function exposed(port: number, expiresAt?: Date): ExposedPort {
  return {
    port,
    previewUrl: `https://p${port}.sandbox.tenki.example`,
    ...(expiresAt ? { expiresAt } : {}),
  };
}

beforeEach(() => {
  process.env["TENKI_API_KEY"] = "test-key";
});

afterEach(() => {
  setTenkiClientForTests(null);
});

describe("ids and template refs", () => {
  it("recognises tk_ ids and tenki: template refs only", () => {
    expect(isTenkiBoxId("tk_abc")).toBe(true);
    expect(isTenkiBoxId("bx_abc")).toBe(false);
    expect(isTenkiTemplateRef("tenki:snap-1")).toBe(true);
    expect(isTenkiTemplateRef("bx_tmpl")).toBe(false);
    expect(toBoxKey("tk_abc")).toBe("abc");
    expect(toSnapshotId("tenki:snap-1")).toBe("snap-1");
  });

  it("refuses to translate ascii identifiers", () => {
    expect(() => toBoxKey("bx_abc")).toThrow(BoxApiError);
    expect(() => toSnapshotId("bx_tmpl")).toThrow(BoxApiError);
  });

  it("mints keys whose tag fits the provider's 32-char lowercase limit", () => {
    const key = newBoxKey();
    expect(key).toMatch(/^[0-9a-f]{24}$/);
    expect(boxTag(toBoxId(key))).toBe(`air-box:${key}`);
    expect(boxTag(toBoxId(key)).length).toBeLessThanOrEqual(TENKI_TAG_MAX_LENGTH);
  });

  it("refuses a box id whose tag would not round-trip through Tenki", () => {
    expect(() => boxTag(toBoxId("0123456789abcdef0123456789abcdef-0000"))).toThrow(
      BoxApiError
    );
    expect(() => boxTag(toBoxId("ABC"))).toThrow(BoxApiError);
  });
});

describe("mapSessionState", () => {
  it("maps every provider state into the Box vocabulary", () => {
    expect(mapSessionState("RUNNING")).toBe("ready");
    expect(mapSessionState("CREATING")).toBe("cloning");
    expect(mapSessionState("RESUMING")).toBe("starting");
    expect(mapSessionState("PAUSING")).toBe("stopping");
    expect(mapSessionState("PAUSED")).toBe("stopped");
    expect(mapSessionState("TERMINATED")).toBe("error");
    expect(mapSessionState("TERMINATING")).toBe("error");
    expect(mapSessionState("USER_SHUTDOWN")).toBe("error");
    expect(mapSessionState("UNSPECIFIED")).toBe("provisioned");
  });
});

describe("toBoxApiError", () => {
  it("maps a missing session to 404 so deleteBox/isStartLimit stay correct", () => {
    const mapped = toBoxApiError(new SessionNotFoundError("gone"));
    expect(mapped.status).toBe(404);
  });

  it("maps quota/capacity refusals to 429", () => {
    expect(toBoxApiError(new QuotaExceededError("no")).status).toBe(429);
  });

  it("maps anything else to 502 and keeps BoxApiError as is", () => {
    expect(toBoxApiError(new Error("boom")).status).toBe(502);
    const own = new BoxApiError(400, "bad");
    expect(toBoxApiError(own)).toBe(own);
  });
});

describe("fork", () => {
  it("creates a sticky, tagged 4c/8g session from the snapshot with the per-box env", async () => {
    const client = install();
    const box = await fork({
      templateId: "tenki:snap-1",
      env: { TENANT_ID: "user-1", GATEWAY_TOKEN: "gw" },
    });
    expect(box).toMatchObject({
      state: "cloning",
      url: undefined,
      vcpu: 4,
      memoryGB: 8,
    });
    expect(isTenkiBoxId(box.id)).toBe(true);
    expect(toBoxKey(box.id)).toMatch(/^[0-9a-f]{24}$/);
    expect(box.id).not.toBe(BOX);
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: "snap-1",
        ...TENKI_BOX_SHAPE,
        sticky: true,
        allowInbound: true,
        tags: [boxTag(box.id)],
        env: { TENANT_ID: "user-1", GATEWAY_TOKEN: "gw" },
        metadata: { air: "box", tenant_id: "user-1" },
        waitReady: false,
      })
    );
  });

  it("rejects an ascii template id", async () => {
    install();
    await expect(
      fork({ templateId: "bx_tmpl", env: { TENANT_ID: "u" } })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("getBox", () => {
  it("reads the live session's state", async () => {
    install([fakeSession("RUNNING")]);
    expect((await getBox(BOX)).state).toBe("ready");
  });

  it("reads a stopped box from its snapshot", async () => {
    install([], [fakeSnapshot("snap-1", "READY")]);
    expect(await getBox(BOX)).toEqual({
      id: BOX,
      state: "stopped",
      url: undefined,
      vcpu: 4,
      memoryGB: 8,
    });
  });

  it("reports stopping while the snapshot is being written", async () => {
    install([fakeSession("RUNNING")], [fakeSnapshot("snap-1", "CREATING")]);
    expect((await getBox(BOX)).state).toBe("stopping");
  });

  it("finishes an interrupted stop once its snapshot is READY", async () => {
    const session = fakeSession("RUNNING");
    install([session], [fakeSnapshot("snap-1", "READY")]);
    expect((await getBox(BOX)).state).toBe("stopped");
    expect(session.close).toHaveBeenCalledOnce();
  });

  it("ignores sessions and snapshots of other boxes and 404s an unknown box", async () => {
    install(
      [fakeSession("RUNNING", { tags: ["air-box:other"] })],
      [fakeSnapshot("snap-1", "READY", { tags: ["air-box:other"] })]
    );
    await expect(getBox(BOX)).rejects.toMatchObject({ status: 404 });
  });

  it("ignores terminated sessions", async () => {
    install([fakeSession("TERMINATED")], [fakeSnapshot("snap-1", "READY")]);
    expect((await getBox(BOX)).state).toBe("stopped");
  });
});

describe("stop", () => {
  it("snapshots the live session, tags it, closes the session and reports stopped", async () => {
    const session = fakeSession("RUNNING");
    const client = install([session]);
    const box = await stop(BOX);
    expect(client.createSnapshotAsync).toHaveBeenCalledWith("sess-1", {
      name: "air-box-box-1",
    });
    expect(client.updateSnapshot).toHaveBeenCalledWith("snap-1", {
      tags: [boxTag(BOX)],
    });
    expect(client.waitSnapshotReady).toHaveBeenCalledWith("snap-1", STOP_WAIT_MS);
    expect(session.close).toHaveBeenCalledOnce();
    expect(box.state).toBe("stopped");
    expect(client.snapshots.map((snapshot) => snapshot.id)).toEqual(["snap-1"]);
  });

  it("prunes the snapshot the session was restored from", async () => {
    const session = fakeSession("RUNNING", { sourceSnapshotId: "snap-old" });
    const client = install([session], [
      fakeSnapshot("snap-old", "READY", { sessionId: "sess-0" }),
    ]);
    await stop(BOX);
    expect(client.deleteSnapshot).toHaveBeenCalledWith("snap-old");
    expect(client.snapshots.map((snapshot) => snapshot.id)).toEqual(["snap-2"]);
  });

  it("does not create a second snapshot when a stop is already in flight", async () => {
    const client = install(
      [fakeSession("RUNNING")],
      [fakeSnapshot("snap-1", "CREATING")]
    );
    const box = await stop(BOX);
    expect(client.createSnapshotAsync).not.toHaveBeenCalled();
    expect(box.state).toBe("stopped");
  });

  it("reports stopping and keeps the session when the snapshot outlives the wait", async () => {
    const session = fakeSession("RUNNING");
    const client = install([session]);
    client.waitSnapshotReady = vi.fn(async () => {
      throw new Error("timeout");
    });
    const box = await stop(BOX);
    expect(box.state).toBe("stopping");
    expect(session.close).not.toHaveBeenCalled();
  });

  it("is a no-op on an already stopped box", async () => {
    const client = install([], [fakeSnapshot("snap-1", "READY")]);
    expect((await stop(BOX)).state).toBe("stopped");
    expect(client.createSnapshotAsync).not.toHaveBeenCalled();
  });

  it("propagates a snapshot the provider refused", async () => {
    const client = install([fakeSession("RUNNING")]);
    client.createSnapshotAsync = vi.fn(async () => {
      throw new Error("HTTP 500");
    });
    await expect(stop(BOX)).rejects.toMatchObject({ status: 502 });
  });
});

describe("resume", () => {
  it("creates a tagged session from the newest READY snapshot", async () => {
    const client = install([], [
      fakeSnapshot("snap-old", "READY", { createdAt: new Date(1) }),
      fakeSnapshot("snap-new", "READY", { createdAt: new Date(2) }),
    ]);
    const box = await resume(BOX);
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: "snap-new",
        tags: [boxTag(BOX)],
        sticky: true,
      })
    );
    expect(box).toMatchObject({ id: BOX, state: "cloning" });
  });

  it("is a no-op on a running session", async () => {
    const client = install([fakeSession("RUNNING")]);
    const box = await resume(BOX);
    expect(client.create).not.toHaveBeenCalled();
    expect(box.state).toBe("ready");
  });

  it("aborts a stop in flight: keeps the live session and drops its snapshot", async () => {
    const client = install(
      [fakeSession("RUNNING")],
      [fakeSnapshot("snap-1", "CREATING")]
    );
    const box = await resume(BOX);
    expect(box.state).toBe("ready");
    expect(client.deleteSnapshot).toHaveBeenCalledWith("snap-1");
    expect(client.create).not.toHaveBeenCalled();
  });

  it("refuses to restore while the snapshot is still being written", async () => {
    install([], [fakeSnapshot("snap-1", "CREATING")]);
    await expect(resume(BOX)).rejects.toMatchObject({ status: 409 });
  });

  it("404s an unknown box", async () => {
    install();
    await expect(resume(BOX)).rejects.toMatchObject({ status: 404 });
  });
});

describe("deleteBox", () => {
  it("closes the session and deletes every snapshot of the box", async () => {
    const session = fakeSession();
    const client = install([session], [
      fakeSnapshot("snap-1", "READY"),
      fakeSnapshot("snap-2", "CREATING"),
    ]);
    await deleteBox(BOX);
    expect(session.close).toHaveBeenCalledOnce();
    expect(client.snapshots).toEqual([]);
  });

  it("treats an unknown box as deleted", async () => {
    install();
    await expect(deleteBox(BOX)).resolves.toBeUndefined();
  });
});

describe("command", () => {
  it("runs as the box user in a login shell from /home/user", () => {
    expect(userCommand("echo hi")).toEqual([
      "sudo",
      "-H",
      "-u",
      "user",
      "bash",
      "-lc",
      "cd '/home/user'\necho hi",
    ]);
  });

  it("returns exit code and decoded output", async () => {
    const session = fakeSession();
    session.exec = vi.fn(async () => ({
      exitCode: 3,
      stdout: new TextEncoder().encode("out\n"),
      stderr: new TextEncoder().encode("err\n"),
    }));
    install([session]);
    const result = await command(BOX, "false", 7);
    expect(result).toEqual({ exitCode: 3, stdout: "out\n", stderr: "err\n" });
    expect(session.exec).toHaveBeenCalledWith(
      "sudo",
      expect.objectContaining({
        args: ["-H", "-u", "user", "bash", "-lc", "cd '/home/user'\nfalse"],
        timeoutMs: 7000,
      })
    );
  });

  it("reports a provider timeout as exit 124 like a shell timeout", async () => {
    const session = fakeSession();
    session.exec = vi.fn(async () => {
      throw new CommandTimeoutError("deadline");
    });
    install([session]);
    const result = await command(BOX, "sleep 999", 1);
    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain("timed out after 1s");
  });
});

describe("writeFile", () => {
  it("writes base64 content under the box user's home for relative paths", () => {
    const cmd = writeFileCommand(".hermes/.env.perbox", "A=1\n$(rm -rf /)\n");
    expect(cmd).toContain("'/home/user/.hermes/.env.perbox'");
    expect(cmd).toContain(
      Buffer.from("A=1\n$(rm -rf /)\n").toString("base64")
    );
    expect(cmd).not.toContain("rm -rf");
  });

  it("keeps absolute paths as given", () => {
    expect(writeFileCommand("/etc/x", "y")).toContain("'/etc/x'");
  });

  it("surfaces a non-zero write as BoxApiError", async () => {
    const session = fakeSession();
    session.exec = vi.fn(async () => ({
      exitCode: 1,
      stdout: new Uint8Array(),
      stderr: new TextEncoder().encode("Permission denied"),
    }));
    install([session]);
    await expect(writeFile(BOX, "x", "y")).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining("Permission denied"),
    });
  });
});

describe("hostRoute", () => {
  it("exposes the port with the route TTL when nothing is exposed", async () => {
    const session = fakeSession();
    session.exposePort = vi.fn(async (port: number) => exposed(port));
    install([session]);
    const route = await hostRoute(BOX, 8642);
    expect(route.url).toBe("https://p8642.sandbox.tenki.example");
    expect(session.exposePort).toHaveBeenCalledWith(8642, {
      ttlMs: ROUTE_TTL_MS,
    });
  });

  it("reuses a fresh existing exposure so hosted_url survives a wake", async () => {
    const session = fakeSession();
    const fresh = new Date(Date.now() + ROUTE_RENEW_BEFORE_MS * 2);
    session.listExposedPorts = vi.fn(async () => [
      exposed(9119, fresh),
      exposed(8642, fresh),
    ]);
    install([session]);
    const route = await hostRoute(BOX, 8642);
    expect(route.url).toBe("https://p8642.sandbox.tenki.example");
    expect(session.exposePort).not.toHaveBeenCalled();
  });

  it("re-exposes a route inside the renewal window", async () => {
    const session = fakeSession();
    const soon = new Date(Date.now() + ROUTE_RENEW_BEFORE_MS / 2);
    session.listExposedPorts = vi.fn(async () => [exposed(8642, soon)]);
    session.exposePort = vi.fn(async (port: number) => ({
      ...exposed(port),
      previewUrl: "https://new.sandbox.tenki.example",
    }));
    install([session]);
    const route = await hostRoute(BOX, 8642);
    expect(session.unexposePort).toHaveBeenCalledWith(8642);
    expect(route.url).toBe("https://new.sandbox.tenki.example");
  });

  it("routeIsFresh treats a missing expiry as permanent", () => {
    expect(routeIsFresh({ expiresAt: undefined })).toBe(true);
    expect(routeIsFresh({ expiresAt: new Date(Date.now() + 1000) })).toBe(false);
  });
});

describe("session lookup", () => {
  it("404s a command against an unknown box", async () => {
    install();
    await expect(command(BOX, "true")).rejects.toMatchObject({ status: 404 });
  });

  it("409s a command against a stopped box", async () => {
    install([], [fakeSnapshot("snap-1", "READY")]);
    await expect(command(BOX, "true")).rejects.toMatchObject({ status: 409 });
  });

  it("surfaces provider errors from list as BoxApiError", async () => {
    const client = install();
    client.list = vi.fn(async () => {
      throw new SessionNotFoundError("gone");
    });
    await expect(command(BOX, "true")).rejects.toMatchObject({ status: 404 });
  });

  it("does not touch the provider for non-tenki ids", async () => {
    const client = install();
    await expect(command("bx_1", "true")).rejects.toMatchObject({ status: 400 });
    expect(client.list).not.toHaveBeenCalled();
  });
});

// Keep the Session type in the picture so a future SDK rename of the members
// the fake implements fails here rather than at runtime.
const _sessionMembers: ReadonlyArray<keyof Session> = [
  "exec",
  "refresh",
  "close",
  "listExposedPorts",
  "exposePort",
  "unexposePort",
];
void _sessionMembers;
