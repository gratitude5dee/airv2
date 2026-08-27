/**
 * Real-profile browsing import (onboarding "Import" step). Consent-gated:
 * one command on the user's machine snapshots their default Chromium
 * browser's ACTIVE profile (Local State → profile.last_used) — cookies,
 * saved logins, preferences — and uploads it to their own box under
 * `.hermes/browser-profile/<browser>/`, where the box-side Hermes drives
 * it with its packaged Chromium (`browser.use_real_profile` in
 * ~/.hermes/config.yaml). Content never touches Postgres (C4): the box is
 * the only store, and the status document carries counts only.
 *
 * Turning the toggle off deletes the snapshot store on the box, so the
 * copied credentials don't linger after consent is revoked.
 *
 * Same short-TTL HMAC upload-ticket discipline as lib/context/importer.ts,
 * with its own domain-separating `use` claim.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, readFile, writeFile } from "../box/client";
import { asRecord } from "../records";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { env } from "../env";

export const BROWSER_PROFILE_USE = "browser_profile_import";
export const BROWSER_PROFILE_TTL_MINUTES = 30;
/** One request carries one base64 part; keep the JSON body under the 4 MB
 * route cap with margin for the envelope. */
export const MAX_PART_B64_BYTES = 3 * 1024 * 1024;
export const MAX_PARTS_PER_FILE = 40;
/** Whole-snapshot budget (decoded) — cookie/login DBs are a few MB each. */
export const MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024;

export const BROWSER_KINDS = ["chrome", "edge", "brave", "chromium"] as const;
export type BrowserKind = (typeof BROWSER_KINDS)[number];

/**
 * Only the auth/preference files of the active profile — never arbitrary
 * paths, never other profiles. `profile/` is the packager's alias for the
 * last-used profile directory; the box lays it out as `Default/` so the
 * packaged Chromium finds it.
 */
export const ALLOWED_SNAPSHOT_PATHS = [
  "Local State",
  "profile/Preferences",
  "profile/Secure Preferences",
  "profile/Cookies",
  "profile/Network/Cookies",
  "profile/Login Data",
  "profile/Login Data For Account",
  "profile/Web Data",
  "profile/Bookmarks",
] as const;

const SNAPSHOT_DIR = ".hermes/browser-profile";
const STAGING_DIR = `${SNAPSHOT_DIR}/.staging`;
/** Lives outside SNAPSHOT_DIR so disable (which deletes the snapshot) can
 * still record that real-profile browsing is off. */
const STATUS_PATH = ".hermes/browser-profile-status.json";

export interface BrowserProfileTicketClaims {
  use: typeof BROWSER_PROFILE_USE;
  userId: string;
  jti: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", env.miniappSigningKey())
    .update(payload)
    .digest("base64url");
}

export function mintBrowserProfileTicket(userId: string): string {
  const claims: BrowserProfileTicketClaims = {
    use: BROWSER_PROFILE_USE,
    userId,
    jti: randomBytes(12).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + BROWSER_PROFILE_TTL_MINUTES * 60,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  console.log(
    JSON.stringify({
      msg: "browser profile import ticket minted",
      user_id: userId,
      jti: claims.jti,
    })
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyBrowserProfileTicket(
  token: string
): BrowserProfileTicketClaims | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: BrowserProfileTicketClaims;
  try {
    claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as BrowserProfileTicketClaims;
  } catch {
    return null;
  }
  if (claims.use !== BROWSER_PROFILE_USE) return null;
  if (!claims.userId || !claims.jti) return null;
  if (typeof claims.exp !== "number") return null;
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}

export class BrowserProfileInputError extends Error {}

export interface BrowserProfileChunk {
  browser: BrowserKind;
  /** One of ALLOWED_SNAPSHOT_PATHS. */
  path: (typeof ALLOWED_SNAPSHOT_PATHS)[number];
  /** 0-based part index; parts of a file must arrive in order. */
  part: number;
  parts: number;
  /** Base64 of this part's bytes. */
  content_b64: string;
  /** The packager marks its first upload — stale staging from an
   * interrupted run is wiped so it can't be concatenated into this one. */
  start: boolean;
  /** The packager marks its last upload — that's the finalize trigger. */
  final: boolean;
}

function isBrowserKind(value: unknown): value is BrowserKind {
  return (
    typeof value === "string" &&
    (BROWSER_KINDS as readonly string[]).includes(value)
  );
}

export function isAllowedSnapshotPath(
  value: unknown
): value is BrowserProfileChunk["path"] {
  return (
    typeof value === "string" &&
    (ALLOWED_SNAPSHOT_PATHS as readonly string[]).includes(value)
  );
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Strict shape validation — reject rather than coerce anything odd. */
export function parseBrowserProfileChunk(raw: unknown): BrowserProfileChunk {
  const doc = asRecord(raw);
  if (!doc) throw new BrowserProfileInputError("body must be a JSON object");
  if (!isBrowserKind(doc["browser"])) {
    throw new BrowserProfileInputError(
      "browser must be chrome, edge, brave, or chromium"
    );
  }
  if (!isAllowedSnapshotPath(doc["path"])) {
    throw new BrowserProfileInputError("path is not an importable profile file");
  }
  const part = doc["part"];
  const parts = doc["parts"];
  if (
    typeof part !== "number" ||
    typeof parts !== "number" ||
    !Number.isInteger(part) ||
    !Number.isInteger(parts) ||
    parts < 1 ||
    parts > MAX_PARTS_PER_FILE ||
    part < 0 ||
    part >= parts
  ) {
    throw new BrowserProfileInputError("invalid part indices");
  }
  const content = doc["content_b64"];
  if (typeof content !== "string" || content.length === 0) {
    throw new BrowserProfileInputError("content_b64 must be a string");
  }
  if (content.length > MAX_PART_B64_BYTES) {
    throw new BrowserProfileInputError(
      `a part exceeds ${MAX_PART_B64_BYTES} base64 bytes — split it smaller`
    );
  }
  if (!B64.test(content.replace(/\n/g, ""))) {
    throw new BrowserProfileInputError("content_b64 is not valid base64");
  }
  return {
    browser: doc["browser"],
    path: doc["path"],
    part,
    parts,
    content_b64: content,
    start: doc["start"] === true,
    final: doc["final"] === true,
  };
}

export interface BrowserProfileStatus {
  enabled: boolean;
  browser: BrowserKind | null;
  files: number;
  bytes: number;
  imported_at: string | null;
}

export function defaultBrowserProfileStatus(): BrowserProfileStatus {
  return { enabled: false, browser: null, files: 0, bytes: 0, imported_at: null };
}

export function normalizeBrowserProfileStatus(
  raw: unknown
): BrowserProfileStatus {
  const status = defaultBrowserProfileStatus();
  const doc = asRecord(raw);
  if (!doc) return status;
  if (typeof doc["enabled"] === "boolean") status.enabled = doc["enabled"];
  if (isBrowserKind(doc["browser"])) status.browser = doc["browser"];
  if (typeof doc["files"] === "number") status.files = doc["files"];
  if (typeof doc["bytes"] === "number") status.bytes = doc["bytes"];
  if (typeof doc["imported_at"] === "string") {
    status.imported_at = doc["imported_at"];
  }
  return status;
}

export async function readBrowserProfileStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<BrowserProfileStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    return normalizeBrowserProfileStatus(
      JSON.parse(await readFile(box.boxId, STATUS_PATH))
    );
  } catch {
    return defaultBrowserProfileStatus();
  }
}

/** Staged part name: safe (allowlisted path + numeric suffix only). */
function stagedPath(chunk: BrowserProfileChunk): string {
  const suffix = String(chunk.part).padStart(4, "0");
  return `${STAGING_DIR}/${chunk.browser}/${chunk.path}.b64part.${suffix}`;
}

/**
 * Stage one validated part on the box. On the final part, assemble the
 * snapshot, flip the config toggle on, and record the status document.
 */
export async function storeBrowserProfileChunk(
  supabase: SupabaseClient,
  userId: string,
  chunk: BrowserProfileChunk
): Promise<BrowserProfileStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  if (chunk.start) {
    const clear = await command(
      box.boxId,
      `rm -rf "$HOME/${STAGING_DIR}/${chunk.browser}"`
    );
    if (clear.exitCode !== 0) {
      throw new Error(`staging reset failed: ${clear.stderr}`);
    }
  }
  await writeFile(box.boxId, stagedPath(chunk), chunk.content_b64);
  console.log(
    JSON.stringify({
      msg: "browser profile part staged",
      user_id: userId,
      box_id: box.boxId,
      browser: chunk.browser,
      part: chunk.part,
      parts: chunk.parts,
      final: chunk.final,
    })
  );
  if (!chunk.final) {
    const status = defaultBrowserProfileStatus();
    status.browser = chunk.browser;
    return status;
  }
  return finalizeBrowserProfile(box.boxId, chunk.browser);
}

/**
 * Assemble staged parts into `.hermes/browser-profile/<browser>/` (the
 * `profile/` alias becomes `Default/`), delete the staging area, enable
 * `browser.use_real_profile`, and write the status document. Everything
 * runs box-side; the assembly script touches only the staging directory
 * and the snapshot directory.
 */
async function finalizeBrowserProfile(
  boxId: string,
  browser: BrowserKind
): Promise<BrowserProfileStatus> {
  const assemble = await command(
    boxId,
    `set -e
cd "$HOME/${STAGING_DIR}/${browser}"
find . -name '*.b64part.0000' | while read -r first; do
  base="\${first%.b64part.0000}"
  rel="\${base#./}"
  case "$rel" in profile/*) out="Default/\${rel#profile/}";; *) out="$rel";; esac
  dest="$HOME/${SNAPSHOT_DIR}/${browser}/$out"
  mkdir -p "$(dirname "$dest")"
  : > "$dest"
  for part in "$base".b64part.*; do
    base64 -d < "$part" >> "$dest"
  done
  chmod 600 "$dest"
done
cd "$HOME/${SNAPSHOT_DIR}/${browser}"
find . -type f | wc -l
find . -type f -printf '%s\\n' | awk '{ s += $1 } END { print s + 0 }'
rm -rf "$HOME/${STAGING_DIR}"`,
    300
  );
  if (assemble.exitCode !== 0) {
    throw new Error(`browser profile assembly failed: ${assemble.stderr}`);
  }
  const lines = assemble.stdout.trim().split("\n");
  const files = Number(lines[lines.length - 2] ?? 0) || 0;
  const bytes = Number(lines[lines.length - 1] ?? 0) || 0;
  if (bytes > MAX_SNAPSHOT_BYTES) {
    await command(boxId, `rm -rf "$HOME/${SNAPSHOT_DIR}"`).catch(
      () => undefined
    );
    await setUseRealProfile(boxId, false).catch(() => undefined);
    await writeFile(
      boxId,
      STATUS_PATH,
      JSON.stringify(defaultBrowserProfileStatus(), null, 2)
    ).catch(() => undefined);
    throw new BrowserProfileInputError("snapshot exceeds the size budget");
  }
  await setUseRealProfile(boxId, true);
  const status: BrowserProfileStatus = {
    enabled: true,
    browser,
    files,
    bytes,
    imported_at: new Date().toISOString(),
  };
  await writeFile(boxId, STATUS_PATH, JSON.stringify(status, null, 2));
  console.log(
    JSON.stringify({
      msg: "browser profile snapshot enabled",
      box_id: boxId,
      browser,
      files,
      bytes,
    })
  );
  return status;
}

/**
 * Revoke consent: delete the snapshot store (so the copied credentials
 * don't linger) and flip the config toggle off.
 */
export async function disableBrowserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<BrowserProfileStatus> {
  const box = await ensureBoxAwake(supabase, userId);
  const wipe = await command(box.boxId, `rm -rf "$HOME/${SNAPSHOT_DIR}"`);
  if (wipe.exitCode !== 0) {
    throw new Error(`browser profile wipe failed: ${wipe.stderr}`);
  }
  await setUseRealProfile(box.boxId, false);
  const status = defaultBrowserProfileStatus();
  await writeFile(box.boxId, STATUS_PATH, JSON.stringify(status, null, 2));
  console.log(
    JSON.stringify({
      msg: "browser profile snapshot deleted",
      user_id: userId,
      box_id: box.boxId,
    })
  );
  return status;
}

/** Patch `browser.use_real_profile` in the box config.yaml (same pattern as
 * lib/vault/managers.ts patchSecretsConfig). */
async function setUseRealProfile(boxId: string, on: boolean): Promise<void> {
  const result = await command(
    boxId,
    `python3 - ${on ? "true" : "false"} <<'PYEOF'
import pathlib, sys, yaml
on = sys.argv[1] == "true"
p = pathlib.Path.home() / ".hermes" / "config.yaml"
cfg = yaml.safe_load(p.read_text()) if p.exists() else None
cfg = cfg if isinstance(cfg, dict) else {}
browser = cfg.get("browser")
browser = browser if isinstance(browser, dict) else {}
browser["use_real_profile"] = on
cfg["browser"] = browser
p.write_text(yaml.safe_dump(cfg, default_flow_style=False))
PYEOF`
  );
  if (result.exitCode !== 0) {
    throw new Error(`config toggle failed: ${result.stderr}`);
  }
}
