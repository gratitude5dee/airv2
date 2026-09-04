/**
 * V11 §8 Lane A — Drop. A file, a folder (zipped by the caller), or a single
 * HTML page becomes a staged draft version:
 *
 *   resolve-or-create app → readZip → validateBundle → lint → uploadVersion
 *   → { slug, version, preview_url, findings }
 *
 * Both entries (owner multipart, Box path over the command lane) land here,
 * so the bundle contract and CR12 run once, in one place. Drop never
 * publishes (CR9): a new app stays `draft`/`unlisted`, and a Drop onto a live
 * app stages a draft without moving what is live. Drop never rewrites the
 * owner's HTML (§8.4) — a single page is stored byte-for-byte as index.html
 * and its dangling relative references are reported, not fixed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { BundleError, readZip, validateBundle, type BundleFile } from "../miniapps/bundles";
import { nestedPathFor } from "../miniapps/nested";
import {
  createDraft,
  ownedApp,
  PublishError,
  publisherUsername,
  slugFor,
  validateAppName,
} from "../miniapps/publish";
import { getRegistryApp, type CreateLane, type RegistryApp } from "../miniapps/registry";
import { enforceCsp, type LintFinding } from "./lint";
import { draftPreviewUrl } from "./preview";
import { uploadVersion } from "./versions";

export type DropKind = "html" | "zip";

export interface DropFile {
  /** Basename as the owner named it; picks the kind and the default appname. */
  name: string;
  bytes: Buffer;
}

export interface DropInput {
  /** Optional: derived from the file name when absent (§8.1). */
  appname?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  file: DropFile;
}

export interface DropResult {
  slug: string;
  appname: string;
  version: string;
  /** Where the app answers once published (mini origin, nested). */
  url: string;
  /** Owner-only draft preview on the app origin; null when that lane is off. */
  preview_url: string | null;
  findings: LintFinding[];
  kind: DropKind;
  status: RegistryApp["status"];
}

const ZIP_MAGIC = Buffer.from("PK\u0003\u0004", "latin1");
const HTML_SNIFF = /^\s*(?:<!--[\s\S]*?-->\s*)*<(?:!doctype\s+html|html|head|body)\b/i;

function extensionOf(name: string): string {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** §8.1: a `.zip` passes through; a single `.html` becomes the root page. */
export function dropKind(file: DropFile): DropKind {
  const ext = extensionOf(file.name);
  if (ext === "zip") return "zip";
  if (ext === "html" || ext === "htm") return "html";
  if (file.bytes.subarray(0, 4).equals(ZIP_MAGIC)) return "zip";
  if (HTML_SNIFF.test(file.bytes.subarray(0, 2048).toString("utf8"))) return "html";
  throw new BundleError("drop a .html page or a .zip of a folder with index.html");
}

/**
 * Unpack the drop into bundle files. HTML is never rewritten — the owner's
 * bytes become `index.html` unchanged; the linter reports what it can't
 * reach (dangling relative refs) as soft findings.
 */
export function normalizeDrop(file: DropFile): { kind: DropKind; files: BundleFile[] } {
  const kind = dropKind(file);
  if (kind === "zip") return { kind, files: readZip(file.bytes) };
  return { kind, files: [{ path: "index.html", bytes: file.bytes }] };
}

/**
 * The default appname for a bare file: `Promo Page.html` → `promo-page`.
 * `index.html` says nothing about the app, so it needs an explicit name.
 */
export function appnameFromFilename(name: string): string | null {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const stem = base.replace(/\.(zip|html?)$/i, "");
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  if (!slug || slug === "index") return null;
  return slug;
}

export function titleFor(appname: string): string {
  return appname
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The owner's app for this appname, created as a draft when it does not
 * exist. A slug held by someone else is "taken" (same answer as createDraft,
 * so the two paths cannot be told apart by probing). Suspended apps refuse
 * new versions — suspension is fail-closed everywhere (§13.3).
 */
export async function resolveDropApp(
  supabase: SupabaseClient,
  userId: string,
  input: { appname: string; name?: string | undefined; description?: string | undefined },
  lane: CreateLane = "drop"
): Promise<RegistryApp> {
  return (await resolveOrCreateDropApp(supabase, userId, input, lane)).app;
}

/**
 * As `resolveDropApp`, also saying whether this call created the row.
 * `created` comes from the insert itself, never from the lookup that
 * preceded it: two concurrent calls for one new appname both miss the
 * lookup, but only the one whose insert won is told it created the app,
 * so only that one may ever discard it (`discardEmptyDraft`).
 */
export async function resolveOrCreateDropApp(
  supabase: SupabaseClient,
  userId: string,
  input: { appname: string; name?: string | undefined; description?: string | undefined },
  lane: CreateLane = "drop"
): Promise<{ app: RegistryApp; created: boolean }> {
  const appname = validateAppName(input.appname);
  const username = await publisherUsername(supabase, userId);
  const slug = slugFor(username, appname);
  const existing = await getRegistryApp(supabase, slug);
  if (existing) {
    if (existing.owner_user_id !== userId) {
      throw new PublishError("that app name is taken", 409);
    }
    if (existing.status === "suspended") {
      throw new PublishError("that app is suspended", 409);
    }
    return { app: existing, created: false };
  }
  const draft = await createDraft(supabase, userId, {
    appname,
    name: input.name?.trim() || titleFor(appname),
    description: input.description ?? "",
    lane,
  });
  return { app: await ownedApp(supabase, userId, slug), created: draft.created };
}

/**
 * Undo a draft row this request created and never filled: only an owned
 * `draft` with neither pointer set goes (`bundle_version` is what a
 * published or legacy upload sets, `draft_version` what staging sets), so
 * a concurrent upload to the same name is never deleted from under its
 * owner.
 */
export async function discardEmptyDraft(
  supabase: SupabaseClient,
  userId: string,
  appId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("mini_apps")
    .delete()
    .eq("id", appId)
    .eq("owner_user_id", userId)
    .eq("status", "draft")
    .is("draft_version", null)
    .is("bundle_version", null)
    .select("id");
  if (error) {
    console.error(JSON.stringify({ msg: "empty draft discard failed", app_id: appId, error: error.message }));
    return false;
  }
  return (data ?? []).length > 0;
}

export async function dropBundle(
  supabase: SupabaseClient,
  userId: string,
  input: DropInput
): Promise<DropResult> {
  const { kind, files } = normalizeDrop(input.file);
  const appname = input.appname?.trim() || appnameFromFilename(input.file.name);
  if (!appname) {
    throw new PublishError("app name required (the file is index.html)");
  }
  // Bundle contract before the registry: a bad bundle never creates an app.
  validateBundle(files);
  const findings = enforceCsp(files);
  const app = await resolveDropApp(supabase, userId, {
    appname,
    name: input.name,
    description: input.description,
  });
  const version = await uploadVersion(supabase, app, files, "drop", {
    findings,
    promote: false,
  });
  const staged: RegistryApp = { ...app, draft_version: version };
  return {
    slug: app.slug,
    appname: app.appname ?? appname,
    version,
    url: `${env.miniappOrigin().replace(/\/$/, "")}${nestedPathFor(app.slug)}`,
    preview_url: draftPreviewUrl(staged),
    findings,
    kind,
    status: app.status,
  };
}
