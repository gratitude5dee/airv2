/**
 * Agent-context import (onboarding "Import" step). One command on the
 * user's machine packages their existing agent context — the local Hermes
 * profile plus Codex CLI and Claude Code session stores (the layouts the
 * codex-claude-transfer and DataMoat projects read) — and uploads it to the
 * user's own box under `.hermes/context/agent-import/` (C4: content never
 * touches Postgres; the status document carries counts only). The final
 * chunk automatically starts an ingestion subagent run that distills
 * everything into `.hermes/context/Dictionary.MD`, the personal dictionary
 * Hermes uses to hyperpersonalize itself.
 *
 * Same short-TTL HMAC upload-ticket discipline as lib/imessage/ingest.ts,
 * with its own domain-separating `use` claim.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "../box/client";
import { asRecord } from "../records";
import { deepMemoryIndex } from "../memory/deep";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { createRun } from "../hermes/client";
import { env } from "../env";

export const CONTEXT_IMPORT_USE = "context_import";
/** Long enough to package and upload three stores, short enough to bound
 * exposure. */
export const IMPORT_TTL_MINUTES = 30;
/** Cap one upload at 4 MB of JSON — the packager chunks beyond that. */
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_FILES_PER_CHUNK = 200;
export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_PATH_LENGTH = 300;

export const IMPORT_SOURCES = ["hermes", "codex", "claude"] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

const IMPORT_DIR = ".hermes/context/agent-import";
const STATUS_PATH = `${IMPORT_DIR}/status.json`;
export const DICTIONARY_PATH = ".hermes/context/Dictionary.MD";

/** Stable viking:// target — re-import replaces, never duplicates. */
export const OV_IMPORT_URI = "viking://resources/context/agent-import";
export const OV_DICTIONARY_URI = "viking://resources/context/dictionary";

/** The ingestion run works in its own Hermes session: the raw import dump
 * must never enter (or invalidate the cached prefix of) the air-main
 * conversation. */
export const IMPORT_SESSION = "air-context-import";

export interface ImportTicketClaims {
  use: typeof CONTEXT_IMPORT_USE;
  userId: string;
  jti: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.miniappSigningKey())
    .update(payload)
    .digest("base64url");
}

export function mintImportTicket(userId: string): string {
  const claims: ImportTicketClaims = {
    use: CONTEXT_IMPORT_USE,
    userId,
    jti: randomBytes(12).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + IMPORT_TTL_MINUTES * 60,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  console.log(
    JSON.stringify({
      msg: "agent context import ticket minted",
      user_id: userId,
      jti: claims.jti,
    })
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyImportTicket(token: string): ImportTicketClaims | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: ImportTicketClaims;
  try {
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as ImportTicketClaims;
  } catch {
    return null;
  }
  if (claims.use !== CONTEXT_IMPORT_USE) return null;
  if (!claims.userId || !claims.jti) return null;
  if (typeof claims.exp !== "number") return null;
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}

export interface ImportFile {
  /** Path relative to the source root, e.g. `sessions/2026/08/rollout-x.jsonl`. */
  path: string;
  content: string;
}

export interface ImportChunk {
  source: ImportSource;
  files: ImportFile[];
  /** The packager marks its last upload — that's the ingestion trigger. */
  final: boolean;
}

export class ImportInputError extends Error {}

/** Safe relative path: no traversal, no absolute paths, no control chars,
 * no secret-bearing names — the packager already excludes them, but the
 * endpoint must not trust the client. */
export function isSafeImportPath(path: string): boolean {
  if (!path || path.length > MAX_PATH_LENGTH) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  if (path.startsWith("/") || path.startsWith("~")) return false;
  if (path.includes("\\")) return false;
  const segments = path.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") return false;
  }
  const lower = path.toLowerCase();
  const name = segments[segments.length - 1]?.toLowerCase() ?? "";
  if (name === ".env" || name.startsWith(".env.")) return false;
  if (/credential|secret|\.pem$|id_rsa|id_ed25519|\.keychain/.test(lower)) {
    return false;
  }
  if (lower.startsWith("vault/") || lower.includes("/vault/")) return false;
  return true;
}

function isImportSource(value: unknown): value is ImportSource {
  return (
    typeof value === "string" &&
    (IMPORT_SOURCES as readonly string[]).includes(value)
  );
}

/** Strict shape validation — reject rather than coerce anything odd. */
export function parseImportChunk(raw: unknown): ImportChunk {
  if (typeof raw !== "object" || raw === null) {
    throw new ImportInputError("body must be a JSON object");
  }
  const doc = raw as { source?: unknown; files?: unknown; final?: unknown };
  if (!isImportSource(doc.source)) {
    throw new ImportInputError("source must be hermes, codex, or claude");
  }
  if (!Array.isArray(doc.files)) {
    throw new ImportInputError("files must be an array");
  }
  if (doc.files.length === 0) {
    throw new ImportInputError("files is empty");
  }
  if (doc.files.length > MAX_FILES_PER_CHUNK) {
    throw new ImportInputError(
      `files exceeds ${MAX_FILES_PER_CHUNK} per upload`
    );
  }
  const files: ImportFile[] = [];
  for (const entry of doc.files) {
    const f = asRecord(entry);
    if (!f || typeof f["path"] !== "string" || typeof f["content"] !== "string") {
      throw new ImportInputError("each file needs path and content strings");
    }
    if (!isSafeImportPath(f["path"])) {
      throw new ImportInputError("file path rejected");
    }
    if (Buffer.byteLength(f["content"], "utf8") > MAX_FILE_BYTES) {
      throw new ImportInputError(
        `a file exceeds ${MAX_FILE_BYTES} bytes — trim it client-side`
      );
    }
    files.push({ path: f["path"], content: f["content"] });
  }
  return { source: doc.source, files, final: doc.final === true };
}

export interface ImportSourceStatus {
  files: number;
  bytes: number;
}

export interface ImportStatus {
  sources: Record<ImportSource, ImportSourceStatus>;
  last_upload_at: string | null;
  dictionary_started_at: string | null;
  dictionary_built_at: string | null;
  dictionary_run_id: string | null;
}

export function defaultImportStatus(): ImportStatus {
  return {
    sources: {
      hermes: { files: 0, bytes: 0 },
      codex: { files: 0, bytes: 0 },
      claude: { files: 0, bytes: 0 },
    },
    last_upload_at: null,
    dictionary_started_at: null,
    dictionary_built_at: null,
    dictionary_run_id: null,
  };
}

export function normalizeImportStatus(raw: unknown): ImportStatus {
  const status = defaultImportStatus();
  const doc = asRecord(raw);
  if (!doc) return status;
  const sources = asRecord(doc["sources"]);
  if (sources) {
    for (const source of IMPORT_SOURCES) {
      const entry = asRecord(sources[source]);
      if (!entry) continue;
      if (typeof entry["files"] === "number") {
        status.sources[source].files = entry["files"];
      }
      if (typeof entry["bytes"] === "number") {
        status.sources[source].bytes = entry["bytes"];
      }
    }
  }
  if (typeof doc["last_upload_at"] === "string") {
    status.last_upload_at = doc["last_upload_at"];
  }
  if (typeof doc["dictionary_started_at"] === "string") {
    status.dictionary_started_at = doc["dictionary_started_at"];
  }
  if (typeof doc["dictionary_built_at"] === "string") {
    status.dictionary_built_at = doc["dictionary_built_at"];
  }
  if (typeof doc["dictionary_run_id"] === "string") {
    status.dictionary_run_id = doc["dictionary_run_id"];
  }
  return status;
}

export function importedFileCount(status: ImportStatus): number {
  return (
    status.sources.hermes.files +
    status.sources.codex.files +
    status.sources.claude.files
  );
}

export async function readImportStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<ImportStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    return normalizeImportStatus(
      JSON.parse(await readFile(box.boxId, STATUS_PATH))
    );
  } catch {
    return defaultImportStatus();
  }
}

/** Write one validated chunk into the box and bump the status document. */
export async function storeImportChunk(
  supabase: SupabaseClient,
  userId: string,
  chunk: ImportChunk
): Promise<ImportStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  let status = defaultImportStatus();
  try {
    status = normalizeImportStatus(
      JSON.parse(await readFile(box.boxId, STATUS_PATH))
    );
  } catch {
    // first upload
  }
  let bytes = 0;
  for (const file of chunk.files) {
    await writeFile(
      box.boxId,
      `${IMPORT_DIR}/${chunk.source}/${file.path}`,
      file.content
    );
    bytes += Buffer.byteLength(file.content, "utf8");
  }
  status.sources[chunk.source].files += chunk.files.length;
  status.sources[chunk.source].bytes += bytes;
  status.last_upload_at = new Date().toISOString();
  await writeFile(box.boxId, STATUS_PATH, JSON.stringify(status, null, 2));
  // Deep memory (docs/memory-upgrade.md): make the imported store
  // semantically searchable box-side. Best-effort, enqueue-only.
  await deepMemoryIndex(box.boxId, `${IMPORT_DIR}/${chunk.source}`, `${OV_IMPORT_URI}/${chunk.source}`);
  console.log(
    JSON.stringify({
      msg: "agent context chunk stored",
      user_id: userId,
      box_id: box.boxId,
      source: chunk.source,
      files: chunk.files.length,
      final: chunk.final,
    })
  );
  return status;
}

/**
 * Fixed ingestion prompt — never client text. The subagent reads only
 * box-local files and writes box-local files; nothing here can echo
 * imported content back through the platform.
 */
export function dictionaryPrompt(): string {
  return [
    "You are running a one-shot personalization ingest. Work only with files on this computer; do not use the browser or send any messages.",
    `1. Read everything under ~/${IMPORT_DIR}/ — it holds the owner's imported context: their previous Hermes profile ("hermes/"), Codex CLI sessions ("codex/"), and Claude Code sessions ("claude/"). Session files are JSONL transcripts. Also skim ~/.hermes/context/imessage-history/ and ~/.hermes/context/onairos.md if present.`,
    "2. Extract durable, useful personal context: who the owner is, how they like to communicate, recurring projects and codebases, tools and stacks they use, named people/teams, preferences and conventions, vocabulary and shorthand they use, standing instructions they gave their previous agents, and things they explicitly told an agent to always/never do. Ignore one-off task noise. NEVER copy passwords, API keys, tokens, or other credentials — if you see one, leave it out.",
    `3. Write the distilled result to ~/${DICTIONARY_PATH} as clean Markdown titled "# Personal Dictionary" with sections: Identity, Communication style, Projects & codebases, Tools & stack, People, Preferences & conventions, Vocabulary, Standing instructions. Keep every entry short and factual; cite nothing verbatim beyond a phrase.`,
    "4. Append a short 'Personal Dictionary' pointer section to ~/.hermes/SOUL.md (create the section only if missing) telling future turns to consult ~/" +
      DICTIONARY_PATH +
      " for the owner's personal context.",
    `5. Finally, update ~/${STATUS_PATH}: set "dictionary_built_at" to the current ISO-8601 UTC timestamp, keeping every other field unchanged.`,
  ].join("\n");
}

export class DictionaryStartError extends Error {}

/**
 * Start the ingestion subagent run that builds Dictionary.MD. Runs in its
 * own Hermes session (IMPORT_SESSION) so the raw dump never touches the
 * air-main conversation or its cached prefix.
 */
export async function startDictionaryRun(
  supabase: SupabaseClient,
  userId: string
): Promise<ImportStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  let status = defaultImportStatus();
  try {
    status = normalizeImportStatus(
      JSON.parse(await readFile(box.boxId, STATUS_PATH))
    );
  } catch {
    // no uploads yet — the caller checks importedFileCount first
  }
  if (importedFileCount(status) === 0) {
    throw new DictionaryStartError("nothing imported yet");
  }
  const run = await createRun(box.target, {
    input: dictionaryPrompt(),
    sessionId: IMPORT_SESSION,
    metadata: {
      app: "onboarding",
      surface: "miniapp",
      workflow: "context_import_dictionary",
    },
  });
  status.dictionary_started_at = new Date().toISOString();
  status.dictionary_built_at = null;
  status.dictionary_run_id = run.run_id;
  await writeFile(box.boxId, STATUS_PATH, JSON.stringify(status, null, 2));
  await supabase.from("agent_runs").insert({
    user_id: userId,
    hermes_run_id: run.run_id,
    trigger: "web",
  });
  // Index the dictionary target so deep memory picks it up once written.
  await deepMemoryIndex(box.boxId, DICTIONARY_PATH, OV_DICTIONARY_URI);
  console.log(
    JSON.stringify({
      msg: "dictionary ingest run started",
      user_id: userId,
      box_id: box.boxId,
      run_id: run.run_id,
    })
  );
  return status;
}
