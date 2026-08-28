/**
 * Stripe Link CLI device auth on the user's box (goal.md payments lane).
 *
 * The Link CLI (`@stripe/link-cli`, baked by infra/template) lets the agent
 * mint one-time-use payment credentials from the OWNER's Link wallet — but
 * only after the owner pairs the box as a device from their Link app. This
 * module drives that pairing from the onboarding slide: `auth login` yields
 * a verification URL the owner opens and approves; `auth status` confirms.
 *
 * Custody stays box-side: the CLI credential file lives on the box (600
 * inside a 700 dir, snapshotted with /home/user) and never transits the
 * control plane. The box doc below carries pairing STATE only —
 * booleans, the link.com verification URL, and the human pairing phrase —
 * never tokens. The Postgres status mirror (lib/miniapps/onboardingMirror)
 * gets booleans and timestamps only — never the phrase or URL.
 * Spend requests still require the owner's approval in their
 * Link app per purchase, and the purchase_review stop is untouched.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, readFile, writeFile } from "../box/client";
import { asRecord } from "../records";
import { ensureBoxAwake } from "../orchestrator/boxes";

/** Box-side CLI credential file — claims stay on the box (C4/C19). */
export const LINK_CREDENTIALS_PATH = "/home/user/.hermes/link/credentials.json";
/** Pairing-state mirror the onboarding slide renders from. */
const LINK_DOC_PATH = ".hermes/miniapps/onboarding/link.json";
/** npm -g under the hermes Node install (infra/template §3b2c). */
const LINK_CLI = "/home/user/.hermes/node/bin/link-cli";
/** Name the owner sees in their Link app when approving the device. */
const CLIENT_NAME = "air agent";

export interface LinkAuthDoc {
  /** false when the box predates the CLI bake (sync-box.sh not yet run). */
  installed: boolean;
  authenticated: boolean;
  verification_url: string | null;
  phrase: string | null;
  updated_at: string | null;
}

export function defaultLinkAuthDoc(): LinkAuthDoc {
  return {
    installed: true,
    authenticated: false,
    verification_url: null,
    phrase: null,
    updated_at: null,
  };
}

/** The box writes this doc too — only render link.com pairing URLs. */
export function safeVerificationUrl(url: string | null): string | null {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (host === "link.com" || host.endsWith(".link.com")) return url;
    return null;
  } catch {
    return null;
  }
}

function normalize(raw: unknown): LinkAuthDoc {
  const doc = defaultLinkAuthDoc();
  if (typeof raw !== "object" || raw === null) return doc;
  const value = raw as Partial<Record<keyof LinkAuthDoc, unknown>>;
  if (value.installed === false) doc.installed = false;
  if (value.authenticated === true) doc.authenticated = true;
  doc.verification_url = safeVerificationUrl(
    typeof value.verification_url === "string" ? value.verification_url : null
  );
  if (typeof value.phrase === "string" && value.phrase.length <= 120) {
    doc.phrase = value.phrase;
  }
  if (typeof value.updated_at === "string") doc.updated_at = value.updated_at;
  return doc;
}

export async function readLinkAuthDoc(
  supabase: SupabaseClient,
  userId: string
): Promise<LinkAuthDoc> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    const raw = await readFile(box.boxId, LINK_DOC_PATH);
    return normalize(JSON.parse(raw));
  } catch {
    return defaultLinkAuthDoc();
  }
}

async function saveDoc(boxId: string, doc: LinkAuthDoc): Promise<LinkAuthDoc> {
  doc.updated_at = new Date().toISOString();
  await writeFile(boxId, LINK_DOC_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

/** First JSON value in CLI stdout; link-cli wraps results in an array. */
function parseCliJson(stdout: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(stdout.trim()) as unknown;
    const first: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
    return asRecord(first);
  } catch {
    return null;
  }
}

function cliMissing(exitCode: number, stderr: string): boolean {
  return exitCode === 127 || /not found|No such file/i.test(stderr);
}

/**
 * Start device pairing: `auth login` returns the verification URL and the
 * pairing phrase immediately (no polling — the slide's "check status"
 * button is the poll). Returns the refreshed mirror doc.
 */
export async function startLinkAuth(
  supabase: SupabaseClient,
  userId: string
): Promise<LinkAuthDoc> {
  const box = await ensureBoxAwake(supabase, userId);
  const doc = defaultLinkAuthDoc();
  const result = await command(
    box.boxId,
    `mkdir -p /home/user/.hermes/link && chmod 700 /home/user/.hermes/link && ` +
      `${LINK_CLI} auth login --client-name ${JSON.stringify(CLIENT_NAME)} ` +
      `--format json --auth ${JSON.stringify(LINK_CREDENTIALS_PATH)} && ` +
      `chmod 600 ${JSON.stringify(LINK_CREDENTIALS_PATH)} 2>/dev/null || true`,
    55
  );
  if (cliMissing(result.exitCode, result.stderr)) {
    doc.installed = false;
    return saveDoc(box.boxId, doc);
  }
  const payload = parseCliJson(result.stdout);
  if (payload) {
    if (payload["authenticated"] === true) {
      doc.authenticated = true;
    } else {
      doc.verification_url = safeVerificationUrl(
        typeof payload["verification_url"] === "string"
          ? payload["verification_url"]
          : null
      );
      doc.phrase =
        typeof payload["phrase"] === "string" ? payload["phrase"].slice(0, 120) : null;
    }
  }
  return saveDoc(box.boxId, doc);
}

/** Refresh pairing state from `auth status`. Returns the mirror doc. */
export async function checkLinkAuth(
  supabase: SupabaseClient,
  userId: string
): Promise<LinkAuthDoc> {
  const box = await ensureBoxAwake(supabase, userId);
  const previous = await readFile(box.boxId, LINK_DOC_PATH)
    .then((raw) => normalize(JSON.parse(raw)))
    .catch(() => defaultLinkAuthDoc());
  const result = await command(
    box.boxId,
    `${LINK_CLI} auth status --format json --auth ${JSON.stringify(LINK_CREDENTIALS_PATH)}`,
    55
  );
  if (cliMissing(result.exitCode, result.stderr)) {
    previous.installed = false;
    return saveDoc(box.boxId, previous);
  }
  previous.installed = true;
  const payload = parseCliJson(result.stdout);
  previous.authenticated = payload?.["authenticated"] === true;
  if (previous.authenticated) {
    previous.verification_url = null;
    previous.phrase = null;
  }
  return saveDoc(box.boxId, previous);
}
