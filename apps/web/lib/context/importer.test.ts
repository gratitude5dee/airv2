/**
 * Agent-context import coverage: the upload ticket round-trips with its own
 * domain-separating use claim, chunk validation fails closed on traversal /
 * secret-bearing paths / oversized files / unknown sources, content lands in
 * the box only (Postgres never sees an imported byte — C4), and the
 * dictionary run starts in its own Hermes session with a fixed prompt and
 * metadata-only fields.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const boxFiles = new Map<string, string>();
const createRunMock = vi.fn(
  async (_target: unknown, _request: unknown) => ({ run_id: "run-42" })
);
const insertMock = vi.fn(async () => ({ error: null }));

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
vi.mock("../memory/deep", () => ({
  deepMemoryIndex: vi.fn(async () => true),
}));
vi.mock("../hermes/client", () => ({
  createRun: (target: unknown, request: unknown) =>
    createRunMock(target, request),
}));

import {
  DictionaryStartError,
  dictionaryPrompt,
  ImportInputError,
  importedFileCount,
  IMPORT_SESSION,
  isSafeImportPath,
  mintImportTicket,
  normalizeImportStatus,
  parseImportChunk,
  readImportStatus,
  startDictionaryRun,
  storeImportChunk,
  verifyImportTicket,
} from "./importer";

const supabase = {
  from: vi.fn(() => ({ insert: insertMock })),
} as unknown as SupabaseClient;

const STATUS_PATH = ".hermes/context/agent-import/status.json";

beforeEach(() => {
  boxFiles.clear();
  createRunMock.mockClear();
  insertMock.mockClear();
});

describe("import tickets", () => {
  it("round-trips for the minting user with the context_import use", () => {
    const claims = verifyImportTicket(mintImportTicket("user-1"));
    expect(claims?.userId).toBe("user-1");
    expect(claims?.use).toBe("context_import");
  });

  it("rejects tampered and garbled tokens", () => {
    const token = mintImportTicket("user-1");
    expect(verifyImportTicket(`${token}x`)).toBeNull();
    expect(verifyImportTicket("not-a-token")).toBeNull();
    expect(verifyImportTicket("")).toBeNull();
  });
});

describe("isSafeImportPath", () => {
  it("accepts normal relative paths", () => {
    expect(isSafeImportPath("sessions/2026/08/rollout-x.jsonl")).toBe(true);
    expect(isSafeImportPath("SOUL.md")).toBe(true);
    expect(isSafeImportPath("projects/-home-me-app/abc.jsonl")).toBe(true);
  });

  it("rejects traversal, absolute paths, and control characters", () => {
    expect(isSafeImportPath("../etc/passwd")).toBe(false);
    expect(isSafeImportPath("a/../../b")).toBe(false);
    expect(isSafeImportPath("/etc/passwd")).toBe(false);
    expect(isSafeImportPath("~/x")).toBe(false);
    expect(isSafeImportPath("a\nb")).toBe(false);
    expect(isSafeImportPath("a\\b")).toBe(false);
    expect(isSafeImportPath("a//b")).toBe(false);
    expect(isSafeImportPath("")).toBe(false);
  });

  it("rejects secret-bearing names even if the packager missed them", () => {
    expect(isSafeImportPath(".env")).toBe(false);
    expect(isSafeImportPath("nested/.env.local")).toBe(false);
    expect(isSafeImportPath("credentials.json")).toBe(false);
    expect(isSafeImportPath("keys/id_rsa")).toBe(false);
    expect(isSafeImportPath("certs/server.pem")).toBe(false);
    expect(isSafeImportPath("vault/item.json")).toBe(false);
    expect(isSafeImportPath("a/vault/item.json")).toBe(false);
  });
});

describe("parseImportChunk", () => {
  const file = { path: "SOUL.md", content: "# me" };

  it("accepts a valid chunk and defaults final to false", () => {
    const chunk = parseImportChunk({ source: "hermes", files: [file] });
    expect(chunk.source).toBe("hermes");
    expect(chunk.files).toHaveLength(1);
    expect(chunk.final).toBe(false);
  });

  it("rejects unknown sources, empty files, and bad shapes", () => {
    expect(() => parseImportChunk(null)).toThrow(ImportInputError);
    expect(() => parseImportChunk({ source: "cursor", files: [file] })).toThrow(
      ImportInputError
    );
    expect(() => parseImportChunk({ source: "hermes", files: [] })).toThrow(
      ImportInputError
    );
    expect(() =>
      parseImportChunk({ source: "hermes", files: [{ path: "a" }] })
    ).toThrow(ImportInputError);
    expect(() =>
      parseImportChunk({ source: "hermes", files: [{ path: "../a", content: "x" }] })
    ).toThrow(ImportInputError);
  });

  it("rejects oversized files", () => {
    const big = { path: "a.md", content: "x".repeat(512 * 1024 + 1) };
    expect(() => parseImportChunk({ source: "codex", files: [big] })).toThrow(
      ImportInputError
    );
  });
});

describe("storeImportChunk", () => {
  it("writes content into the box only and bumps per-source counters", async () => {
    const status = await storeImportChunk(supabase, "user-1", {
      source: "codex",
      files: [
        { path: "sessions/2026/08/rollout-a.jsonl", content: "{}" },
        { path: "AGENTS.md", content: "# rules" },
      ],
      final: false,
    });
    expect(status.sources.codex.files).toBe(2);
    expect(
      boxFiles.get(
        ".hermes/context/agent-import/codex/sessions/2026/08/rollout-a.jsonl"
      )
    ).toBe("{}");
    expect(boxFiles.get(STATUS_PATH)).toContain('"files": 2');
    // no Postgres writes on the upload path
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("accumulates across uploads and sources", async () => {
    await storeImportChunk(supabase, "user-1", {
      source: "hermes",
      files: [{ path: "SOUL.md", content: "# me" }],
      final: false,
    });
    const status = await storeImportChunk(supabase, "user-1", {
      source: "claude",
      files: [{ path: "CLAUDE.md", content: "# style" }],
      final: true,
    });
    expect(importedFileCount(status)).toBe(2);
  });
});

describe("startDictionaryRun", () => {
  it("refuses to start with nothing imported", async () => {
    await expect(startDictionaryRun(supabase, "user-1")).rejects.toThrow(
      DictionaryStartError
    );
    expect(createRunMock).not.toHaveBeenCalled();
  });

  it("starts an isolated-session run with a fixed prompt and metadata-only fields", async () => {
    await storeImportChunk(supabase, "user-1", {
      source: "claude",
      files: [{ path: "CLAUDE.md", content: "# style" }],
      final: false,
    });
    const status = await startDictionaryRun(supabase, "user-1");
    expect(status.dictionary_run_id).toBe("run-42");
    expect(status.dictionary_started_at).not.toBeNull();
    expect(createRunMock).toHaveBeenCalledTimes(1);
    const request = createRunMock.mock.calls[0]?.[1] as unknown as {
      input: string;
      sessionId: string;
      metadata: Record<string, string>;
    };
    expect(request.sessionId).toBe(IMPORT_SESSION);
    expect(request.sessionId).not.toBe("air-main");
    expect(request.input).toBe(dictionaryPrompt());
    expect(request.input).toContain("Dictionary.MD");
    // metadata is identifiers only — never content
    expect(Object.values(request.metadata).join(" ")).not.toContain("# style");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});

describe("status normalization", () => {
  it("fails closed to defaults on garbage", () => {
    const status = normalizeImportStatus("garbage");
    expect(importedFileCount(status)).toBe(0);
    expect(status.dictionary_built_at).toBeNull();
  });

  it("readImportStatus degrades to defaults when the box has no status", async () => {
    const status = await readImportStatus(supabase, "user-1");
    expect(importedFileCount(status)).toBe(0);
  });
});

describe("dictionaryPrompt", () => {
  it("is fixed text pointing at box-local paths only", () => {
    const prompt = dictionaryPrompt();
    expect(prompt).toContain(".hermes/context/agent-import");
    expect(prompt).toContain(".hermes/context/Dictionary.MD");
    expect(prompt).toContain("dictionary_built_at");
    expect(prompt).toMatch(/NEVER copy passwords/);
  });
});
