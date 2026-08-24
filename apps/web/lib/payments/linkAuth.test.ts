/**
 * Link CLI device pairing (linkAuth.ts): the mirror doc carries pairing
 * STATE only, verification URLs are restricted to link.com, and a missing
 * CLI degrades to installed:false instead of throwing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const boxFiles = new Map<string, string>();
const command = vi.fn();

vi.mock("../box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new Error("not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
  command: (...args: unknown[]) => command(...(args as [])),
}));
vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "target-1" })),
  StartLimitError: class extends Error {},
}));

import {
  checkLinkAuth,
  readLinkAuthDoc,
  safeVerificationUrl,
  startLinkAuth,
} from "./linkAuth";

const supabase = {} as SupabaseClient;
const DOC_PATH = ".hermes/miniapps/onboarding/link.json";

beforeEach(() => {
  boxFiles.clear();
  command.mockReset();
});

describe("safeVerificationUrl", () => {
  it("accepts https link.com pairing URLs only", () => {
    expect(
      safeVerificationUrl("https://app.link.com/device/setup?code=a-b-c")
    ).toBe("https://app.link.com/device/setup?code=a-b-c");
    expect(safeVerificationUrl("https://link.com/pair")).toBe(
      "https://link.com/pair"
    );
  });

  it("rejects other hosts, schemes, and lookalikes", () => {
    expect(safeVerificationUrl("https://evil.com/link.com")).toBeNull();
    expect(safeVerificationUrl("https://notlink.com/x")).toBeNull();
    expect(safeVerificationUrl("http://app.link.com/x")).toBeNull();
    expect(safeVerificationUrl("javascript:alert(1)")).toBeNull();
    expect(safeVerificationUrl(null)).toBeNull();
  });
});

describe("startLinkAuth", () => {
  it("stores the verification URL and phrase from auth login", async () => {
    command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify([
        {
          authenticated: false,
          verification_url: "https://app.link.com/device/setup?code=x-y-z",
          phrase: "x-y-z",
        },
      ]),
      stderr: "",
    });
    const doc = await startLinkAuth(supabase, "user-1");
    expect(doc.verification_url).toBe(
      "https://app.link.com/device/setup?code=x-y-z"
    );
    expect(doc.phrase).toBe("x-y-z");
    expect(doc.authenticated).toBe(false);
    expect(boxFiles.get(DOC_PATH)).toContain("app.link.com");
    // The pairing command targets the box-side credential file.
    expect(String(command.mock.calls[0]?.[1])).toContain(
      "/home/user/.hermes/link/credentials.json"
    );
  });

  it("drops non-link.com verification URLs from CLI output", async () => {
    command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify([
        { authenticated: false, verification_url: "https://evil.com/pair" },
      ]),
      stderr: "",
    });
    const doc = await startLinkAuth(supabase, "user-1");
    expect(doc.verification_url).toBeNull();
  });

  it("marks the CLI missing on exit 127", async () => {
    command.mockResolvedValueOnce({
      exitCode: 127,
      stdout: "",
      stderr: "link-cli: command not found",
    });
    const doc = await startLinkAuth(supabase, "user-1");
    expect(doc.installed).toBe(false);
    expect(doc.authenticated).toBe(false);
  });
});

describe("checkLinkAuth", () => {
  it("clears the pending URL and phrase once authenticated", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({
        installed: true,
        authenticated: false,
        verification_url: "https://app.link.com/device/setup?code=x",
        phrase: "x",
      })
    );
    command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify([{ authenticated: true }]),
      stderr: "",
    });
    const doc = await checkLinkAuth(supabase, "user-1");
    expect(doc.authenticated).toBe(true);
    expect(doc.verification_url).toBeNull();
    expect(doc.phrase).toBeNull();
  });

  it("stays unauthenticated while the owner has not approved", async () => {
    command.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify([{ authenticated: false }]),
      stderr: "",
    });
    const doc = await checkLinkAuth(supabase, "user-1");
    expect(doc.authenticated).toBe(false);
  });
});

describe("readLinkAuthDoc", () => {
  it("returns the default doc when nothing is stored", async () => {
    const doc = await readLinkAuthDoc(supabase, "user-1");
    expect(doc).toMatchObject({
      installed: true,
      authenticated: false,
      verification_url: null,
      phrase: null,
    });
  });

  it("sanitizes a box-forged verification URL on read", async () => {
    boxFiles.set(
      DOC_PATH,
      JSON.stringify({
        installed: true,
        authenticated: false,
        verification_url: "https://phish.example/link",
        phrase: "a".repeat(500),
      })
    );
    const doc = await readLinkAuthDoc(supabase, "user-1");
    expect(doc.verification_url).toBeNull();
    expect(doc.phrase).toBeNull();
  });
});
