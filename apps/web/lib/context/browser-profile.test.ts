/**
 * Real-profile browsing import coverage: the upload ticket round-trips with
 * its own domain-separating use claim (an agent-context ticket must not
 * open this endpoint), chunk validation fails closed on non-allowlisted
 * paths / bad part indices / non-base64 content, parts stage on the box
 * only (Postgres never sees a profile byte — C4), the final part assembles
 * the snapshot and flips `browser.use_real_profile` on, and disable wipes
 * the snapshot store and flips the toggle off.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const boxFiles = new Map<string, string>();
const commandMock = vi.fn(async (_boxId: string, _cmd: string) => ({
  exitCode: 0,
  stdout: "3\n1024\n",
  stderr: "",
}));

vi.mock("../env", () => ({
  env: { miniappSigningKey: () => "test-signing-key" },
}));
vi.mock("../box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new Error("not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
  command: (boxId: string, cmd: string, _timeout?: number) =>
    commandMock(boxId, cmd),
}));
vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({
    boxId: "box-1",
    target: {
      hostedUrl: "https://box.example",
      hostedToken: "t",
      apiServerKey: "k",
    },
  })),
}));

import { mintImportTicket } from "./importer";
import {
  BrowserProfileInputError,
  disableBrowserProfile,
  isAllowedSnapshotPath,
  mintBrowserProfileTicket,
  normalizeBrowserProfileStatus,
  parseBrowserProfileChunk,
  readBrowserProfileStatus,
  storeBrowserProfileChunk,
  verifyBrowserProfileTicket,
} from "./browser-profile";

const supabase = {} as unknown as SupabaseClient;

const STATUS_PATH = ".hermes/browser-profile-status.json";

function chunk(overrides: Record<string, unknown> = {}): unknown {
  return {
    browser: "chrome",
    path: "profile/Cookies",
    part: 0,
    parts: 1,
    content_b64: Buffer.from("sqlite bytes").toString("base64"),
    final: false,
    ...overrides,
  };
}

beforeEach(() => {
  boxFiles.clear();
  commandMock.mockClear();
});

describe("browser profile tickets", () => {
  it("round-trips with the browser_profile_import use", () => {
    const claims = verifyBrowserProfileTicket(
      mintBrowserProfileTicket("user-1")
    );
    expect(claims?.userId).toBe("user-1");
    expect(claims?.use).toBe("browser_profile_import");
  });

  it("rejects an agent-context ticket (domain separation)", () => {
    expect(verifyBrowserProfileTicket(mintImportTicket("user-1"))).toBeNull();
  });

  it("rejects a tampered ticket", () => {
    const token = mintBrowserProfileTicket("user-1");
    expect(verifyBrowserProfileTicket(`${token}x`)).toBeNull();
  });
});

describe("chunk validation", () => {
  it("accepts an allowlisted profile file part", () => {
    const parsed = parseBrowserProfileChunk(chunk());
    expect(parsed.browser).toBe("chrome");
    expect(parsed.path).toBe("profile/Cookies");
  });

  it("rejects non-allowlisted paths (no arbitrary box writes)", () => {
    for (const path of [
      "profile/../../.ssh/id_rsa",
      "profile/History",
      "Default/Cookies",
      "/etc/passwd",
      "profile/Cookies.b64part.0000",
    ]) {
      expect(() => parseBrowserProfileChunk(chunk({ path }))).toThrow(
        BrowserProfileInputError
      );
      expect(isAllowedSnapshotPath(path)).toBe(false);
    }
  });

  it("rejects unknown browsers", () => {
    expect(() =>
      parseBrowserProfileChunk(chunk({ browser: "firefox" }))
    ).toThrow(BrowserProfileInputError);
  });

  it("rejects bad part indices", () => {
    expect(() =>
      parseBrowserProfileChunk(chunk({ part: 2, parts: 2 }))
    ).toThrow(BrowserProfileInputError);
    expect(() =>
      parseBrowserProfileChunk(chunk({ part: -1, parts: 1 }))
    ).toThrow(BrowserProfileInputError);
    expect(() =>
      parseBrowserProfileChunk(chunk({ parts: 9999, part: 0 }))
    ).toThrow(BrowserProfileInputError);
  });

  it("rejects non-base64 content", () => {
    expect(() =>
      parseBrowserProfileChunk(chunk({ content_b64: "not base64!!" }))
    ).toThrow(BrowserProfileInputError);
    expect(() =>
      parseBrowserProfileChunk(chunk({ content_b64: "" }))
    ).toThrow(BrowserProfileInputError);
  });
});

describe("staging and finalize", () => {
  it("stages a non-final part on the box without running commands", async () => {
    const status = await storeBrowserProfileChunk(
      supabase,
      "user-1",
      parseBrowserProfileChunk(chunk())
    );
    expect(status.enabled).toBe(false);
    expect(
      boxFiles.get(
        ".hermes/browser-profile/.staging/chrome/profile/Cookies.b64part.0000"
      )
    ).toBe(Buffer.from("sqlite bytes").toString("base64"));
    expect(commandMock).not.toHaveBeenCalled();
  });

  it("assembles, enables the config toggle, and records status on final", async () => {
    const status = await storeBrowserProfileChunk(
      supabase,
      "user-1",
      parseBrowserProfileChunk(chunk({ final: true }))
    );
    expect(status.enabled).toBe(true);
    expect(status.browser).toBe("chrome");
    expect(status.files).toBe(3);
    expect(status.bytes).toBe(1024);
    const commands = commandMock.mock.calls.map((call) => call[1]);
    expect(commands.some((cmd) => cmd.includes("base64 -d"))).toBe(true);
    expect(commands.some((cmd) => cmd.includes("use_real_profile"))).toBe(
      true
    );
    const saved = JSON.parse(boxFiles.get(STATUS_PATH) ?? "{}");
    expect(saved.enabled).toBe(true);
  });

  it("disables the toggle and status when an over-budget snapshot is wiped", async () => {
    commandMock.mockResolvedValueOnce({
      exitCode: 0,
      stdout: `3\n${999 * 1024 * 1024 * 1024}\n`,
      stderr: "",
    });
    await expect(
      storeBrowserProfileChunk(
        supabase,
        "user-1",
        parseBrowserProfileChunk(chunk({ final: true }))
      )
    ).rejects.toThrow(BrowserProfileInputError);
    const commands = commandMock.mock.calls.map((call) => call[1]);
    expect(
      commands.some((cmd) =>
        cmd.includes('rm -rf "$HOME/.hermes/browser-profile"')
      )
    ).toBe(true);
    expect(commands.some((cmd) => cmd.includes("use_real_profile"))).toBe(
      true
    );
    const saved = JSON.parse(boxFiles.get(STATUS_PATH) ?? "{}");
    expect(saved.enabled).toBe(false);
  });

  it("keeps profile bytes out of Postgres entirely (C4)", async () => {
    // supabase is an empty object: any .from() call would throw.
    await storeBrowserProfileChunk(
      supabase,
      "user-1",
      parseBrowserProfileChunk(chunk({ final: true }))
    );
  });
});

describe("disable", () => {
  it("wipes the snapshot store and flips the toggle off", async () => {
    const status = await disableBrowserProfile(supabase, "user-1");
    expect(status.enabled).toBe(false);
    const commands = commandMock.mock.calls.map((call) => call[1]);
    expect(
      commands.some((cmd) => cmd.includes('rm -rf "$HOME/.hermes/browser-profile"'))
    ).toBe(true);
    expect(commands.some((cmd) => cmd.includes("use_real_profile"))).toBe(
      true
    );
    const saved = JSON.parse(boxFiles.get(STATUS_PATH) ?? "{}");
    expect(saved.enabled).toBe(false);
  });
});

describe("status document", () => {
  it("defaults when missing and normalizes odd shapes", async () => {
    expect((await readBrowserProfileStatus(supabase, "user-1")).enabled).toBe(
      false
    );
    const normalized = normalizeBrowserProfileStatus({
      enabled: true,
      browser: "brave",
      files: "not-a-number",
      bytes: 7,
      imported_at: 12,
    });
    expect(normalized.enabled).toBe(true);
    expect(normalized.browser).toBe("brave");
    expect(normalized.files).toBe(0);
    expect(normalized.bytes).toBe(7);
    expect(normalized.imported_at).toBeNull();
  });
});
