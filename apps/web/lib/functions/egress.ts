/**
 * V11 §9.4 / §11.5 (CR7): a Functions Worker reaches nothing by default.
 * `air.json.functions` declares what the owner may approve — exact https
 * hostnames only — and the Outbound Worker matches host strings against the
 * *approved* list, never the working tree's. This module is the single
 * definition of what a declaration may say; the Build Service (hard
 * findings), the Functions tab (client-side echo) and the decision payload
 * all read it.
 */
import { z } from "zod";

export const EGRESS_MAX_HOSTS = 10;
/** The runtime API host; always reachable, never listed (§11.3). */
export const AIR_INTERNAL_HOST = "air.internal";
export const FN_DAILY_CAP_MIN_USD = 0.05;
export const FN_DAILY_CAP_MAX_USD = 5;
export const FN_DAILY_CAP_DEFAULT_USD = 1;

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_RE = /^[a-z]{2,63}$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Suffixes no owner can approve: the platform's own origins (a Worker must
 * never talk to the mini origin, the app origin, or the control plane —
 * §16 "user Worker reaches the platform"), the data plane, and names that
 * only resolve inside some network.
 */
const BLOCKED_SUFFIXES = [
  "wzrd.tech",
  "supabase.co",
  "supabase.in",
  "supabase.net",
  "workers.dev",
  "pages.dev",
  "vercel.app",
  "localhost",
  "local",
  "internal",
  "lan",
  "home",
  "corp",
  "intranet",
  "arpa",
  "onion",
  "invalid",
];

export type EgressRejection =
  | "empty"
  | "scheme"
  | "wildcard"
  | "port"
  | "path"
  | "ip_literal"
  | "not_a_hostname"
  | "platform_or_private"
  | "too_long";

/**
 * Why `raw` is not an approvable egress host, or null when it is. The
 * normalized (lowercased, dot-trimmed) form is what callers should store.
 */
export function egressHostRejection(raw: string): EgressRejection | null {
  const host = raw.trim().toLowerCase();
  if (!host) return "empty";
  if (host.length > 253) return "too_long";
  if (host.includes("://") || host.startsWith("https:") || host.startsWith("http:")) {
    return "scheme";
  }
  if (host.includes("*")) return "wildcard";
  if (host.includes("/") || host.includes("?") || host.includes("#") || host.includes("@")) {
    return "path";
  }
  if (host.startsWith("[") || host.includes(":")) {
    return host.startsWith("[") || /^[0-9a-f:.]+$/.test(host) ? "ip_literal" : "port";
  }
  if (IPV4_RE.test(host)) return "ip_literal";
  const labels = host.replace(/\.$/, "").split(".");
  if (labels.length < 2) return "not_a_hostname";
  if (!labels.every((label) => LABEL_RE.test(label))) return "not_a_hostname";
  if (!TLD_RE.test(labels[labels.length - 1]!)) return "not_a_hostname";
  const normalized = labels.join(".");
  if (normalized === AIR_INTERNAL_HOST) return "platform_or_private";
  for (const suffix of BLOCKED_SUFFIXES) {
    if (normalized === suffix || normalized.endsWith(`.${suffix}`)) {
      return "platform_or_private";
    }
  }
  return null;
}

export function normalizeEgressHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

export function describeEgressRejection(reason: EgressRejection): string {
  switch (reason) {
    case "empty":
      return "is empty";
    case "scheme":
      return "must be a bare hostname (no https://)";
    case "wildcard":
      return "wildcards are not allowed; list each host exactly";
    case "port":
      return "ports are not allowed; only https on 443 is reachable";
    case "path":
      return "must be a hostname, not a URL";
    case "ip_literal":
      return "IP addresses are not allowed; use a hostname";
    case "not_a_hostname":
      return "is not a valid hostname";
    case "platform_or_private":
      return "is a platform, private, or reserved name and can never be approved";
    case "too_long":
      return "is too long";
  }
}

/** Exact-match egress decision the Outbound Worker also implements (§11.5). */
export function egressAllowed(host: string, approved: readonly string[]): boolean {
  const normalized = normalizeEgressHost(host);
  if (normalized === AIR_INTERNAL_HOST) return true;
  return approved.some((h) => normalizeEgressHost(h) === normalized);
}

const egressHost = z
  .string()
  .max(253)
  .superRefine((value, ctx) => {
    const reason = egressHostRejection(value);
    if (reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `egress host "${value}" ${describeEgressRejection(reason)}`,
      });
    }
  })
  .transform(normalizeEgressHost);

/**
 * The `functions` block of air.json (§9.4). `entry` is the Worker module
 * under `functions/`; everything else is what the owner approves.
 */
export const functionsDeclarationSchema = z
  .object({
    entry: z
      .string()
      .regex(
        /^functions\/[A-Za-z0-9_./-]+\.(ts|js|mjs|tsx)$/,
        "functions.entry must be a file under functions/"
      )
      .default("functions/index.ts"),
    db: z.boolean().default(false),
    kv: z.boolean().default(false),
    egress: z
      .array(egressHost)
      .max(EGRESS_MAX_HOSTS, `functions.egress lists at most ${EGRESS_MAX_HOSTS} hosts`)
      .default([])
      .transform((hosts) => [...new Set(hosts)].sort()),
    ai: z
      .object({
        dailyCapUsd: z
          .number()
          .min(FN_DAILY_CAP_MIN_USD)
          .max(FN_DAILY_CAP_MAX_USD)
          .default(FN_DAILY_CAP_DEFAULT_USD),
      })
      .default({ dailyCapUsd: FN_DAILY_CAP_DEFAULT_USD }),
  })
  .strict();

export type FunctionsDeclaration = z.infer<typeof functionsDeclarationSchema>;

/**
 * What the owner approves (§4.1 miniapp_backend payload, §11.6 approved
 * manifest): egress, db/kv, the daily cap. Secret *names* ride along so the
 * card can show them; the entry path is a build concern, not an approval.
 */
export interface ApprovedBackend {
  egress: string[];
  db: boolean;
  kv: boolean;
  dailyCapUsd: number;
  secretNames: string[];
}

export function approvedFrom(
  declared: FunctionsDeclaration,
  secretNames: readonly string[]
): ApprovedBackend {
  return {
    egress: [...declared.egress].sort(),
    db: declared.db,
    kv: declared.kv,
    dailyCapUsd: declared.ai.dailyCapUsd,
    secretNames: [...secretNames].sort(),
  };
}

/** True when `next` widens or changes anything the owner approved. */
export function approvalChanged(
  approved: ApprovedBackend | null,
  next: ApprovedBackend
): boolean {
  if (!approved) return true;
  return (
    approved.db !== next.db ||
    approved.kv !== next.kv ||
    approved.dailyCapUsd !== next.dailyCapUsd ||
    approved.egress.join("\n") !== next.egress.join("\n") ||
    approved.secretNames.join("\n") !== next.secretNames.join("\n")
  );
}

export function parseApprovedBackend(value: unknown): ApprovedBackend | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const egress = Array.isArray(record["egress"])
    ? record["egress"].filter((h): h is string => typeof h === "string")
    : [];
  const secretNames = Array.isArray(record["secretNames"])
    ? record["secretNames"].filter((h): h is string => typeof h === "string")
    : [];
  const cap = Number(record["dailyCapUsd"]);
  return {
    egress: [...egress].sort(),
    db: record["db"] === true,
    kv: record["kv"] === true,
    dailyCapUsd: Number.isFinite(cap) && cap > 0 ? cap : FN_DAILY_CAP_DEFAULT_USD,
    secretNames: [...secretNames].sort(),
  };
}

export function parseFunctionsDeclaration(value: unknown): FunctionsDeclaration | null {
  const parsed = functionsDeclarationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
