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
import { shellQuote } from "../box/shell";
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
const REQUIRED_SCOPES = ["userinfo:read", "payment_methods.agentic"] as const;

export type AgentPaymentGrant = "ready" | "missing" | "unknown";

export interface LinkAuthDoc {
  /** false when the box predates the CLI bake (sync-box.sh not yet run). */
  installed: boolean;
  /** True when Link has an active device session, independent of its grants. */
  session_authenticated: boolean;
  /** Required scopes are verified before payments are advertised as ready. */
  agent_payment_grant: AgentPaymentGrant;
  /** True only when the session and both agent-payment grants are verified. */
  authenticated: boolean;
  verification_url: string | null;
  phrase: string | null;
  updated_at: string | null;
}

export function defaultLinkAuthDoc(): LinkAuthDoc {
  return {
    installed: true,
    session_authenticated: false,
    agent_payment_grant: "unknown",
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
  if (value.session_authenticated === true) doc.session_authenticated = true;
  if (
    value.agent_payment_grant === "ready" ||
    value.agent_payment_grant === "missing" ||
    value.agent_payment_grant === "unknown"
  ) {
    doc.agent_payment_grant = value.agent_payment_grant;
  }
  // Legacy docs only had `authenticated`. Preserve the knowledge that the
  // device session existed, but do not claim agent-payment readiness until
  // the current CLI status verifies both required scopes.
  if (value.authenticated === true) doc.session_authenticated = true;
  doc.authenticated =
    doc.session_authenticated && doc.agent_payment_grant === "ready";
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

function parseScopes(payload: Record<string, unknown> | null): {
  present: boolean;
  values: Set<string>;
} {
  if (!payload) return { present: false, values: new Set() };
  const values = new Set<string>();
  let present = false;
  const candidates = [
    payload["scope"],
    payload["scopes"],
    asRecord(payload["session"])?.["scope"],
    asRecord(payload["session"])?.["scopes"],
    asRecord(payload["authorization"])?.["scope"],
    asRecord(payload["authorization"])?.["scopes"],
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    present = true;
    const items = Array.isArray(candidate) ? candidate : [candidate];
    for (const item of items) {
      if (typeof item !== "string") continue;
      for (const scope of item.split(/[\s,]+/u)) {
        if (scope) values.add(scope);
      }
    }
  }
  return { present, values };
}

function applyStatus(doc: LinkAuthDoc, payload: Record<string, unknown> | null): void {
  doc.session_authenticated = payload?.["authenticated"] === true;
  if (!doc.session_authenticated) {
    doc.agent_payment_grant = "unknown";
    doc.authenticated = false;
    return;
  }
  const scopes = parseScopes(payload);
  doc.agent_payment_grant = !scopes.present
    ? "unknown"
    : REQUIRED_SCOPES.every((scope) => scopes.values.has(scope))
      ? "ready"
      : "missing";
  doc.authenticated = doc.agent_payment_grant === "ready";
}

function statusCommand(): string {
  return `${LINK_CLI} auth status --format json --auth ${shellQuote(LINK_CREDENTIALS_PATH)}`;
}

function pairingCommand(mode: "login" | "upgrade"): string {
  const cli =
    `${LINK_CLI} auth ${mode} --clientName ${shellQuote(CLIENT_NAME)} ` +
    `--scope ${shellQuote(REQUIRED_SCOPES.join(" "))} --format json ` +
    `--auth ${shellQuote(LINK_CREDENTIALS_PATH)}`;
  // Preserve the CLI's real exit status while applying least-privilege file
  // modes when it created or refreshed the credential file.
  return (
    `install -d -m 700 /home/user/.hermes/link; ${cli}; ` +
    `link_status=$?; if [ -f ${shellQuote(LINK_CREDENTIALS_PATH)} ]; then ` +
    `chmod 600 ${shellQuote(LINK_CREDENTIALS_PATH)}; fi; exit $link_status`
  );
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
  const status = await command(box.boxId, statusCommand(), 55);
  if (cliMissing(status.exitCode, status.stderr)) {
    doc.installed = false;
    return saveDoc(box.boxId, doc);
  }
  applyStatus(doc, parseCliJson(status.stdout));
  if (doc.authenticated) return saveDoc(box.boxId, doc);

  const mode = doc.session_authenticated ? "upgrade" : "login";
  const result = await command(box.boxId, pairingCommand(mode), 55);
  if (cliMissing(result.exitCode, result.stderr)) {
    doc.installed = false;
    return saveDoc(box.boxId, doc);
  }
  const payload = parseCliJson(result.stdout);
  if (payload) {
    if (payload["authenticated"] === true) {
      applyStatus(doc, payload);
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
    statusCommand(),
    55
  );
  if (cliMissing(result.exitCode, result.stderr)) {
    previous.installed = false;
    return saveDoc(box.boxId, previous);
  }
  previous.installed = true;
  const payload = parseCliJson(result.stdout);
  applyStatus(previous, payload);
  if (previous.session_authenticated) {
    previous.verification_url = null;
    previous.phrase = null;
  }
  return saveDoc(box.boxId, previous);
}
