/**
 * V11 §6: nested URLs over the flat registry key. Published apps keep their
 * `<username>-<appname>` slug as the registry primary key; the mini origin
 * routes them at `/<username>/<appname>` and redirects the flat form. The
 * split is deterministic because usernames (`[a-z0-9_]{2,24}`) never contain
 * a hyphen and app names never contain an underscore — the first hyphen is
 * always the boundary.
 *
 * Imported by middleware (edge runtime): no Node imports, no env reads.
 */
import { isReservedWord } from "./reserved";

export const USERNAME_RE = /^[a-z0-9_]{2,24}$/;
export const APPNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export interface NestedSlug {
  username: string;
  appname: string;
}

/** `alice-notes` → `{ username: "alice", appname: "notes" }`; null for bare slugs. */
export function splitPublishedSlug(slug: string): NestedSlug | null {
  const at = slug.indexOf("-");
  if (at <= 0) return null;
  const username = slug.slice(0, at);
  const appname = slug.slice(at + 1);
  if (!USERNAME_RE.test(username) || !APPNAME_RE.test(appname)) return null;
  if (isReservedWord(username)) return null;
  return { username, appname };
}

export function joinPublishedSlug(username: string, appname: string): string {
  return `${username}-${appname}`;
}

/** Canonical mini-origin path for a registry slug (`/<u>/<a>` or `/<slug>`). */
export function nestedPathFor(slug: string): string {
  const parts = splitPublishedSlug(slug);
  return parts ? `/${parts.username}/${parts.appname}` : `/${slug}`;
}

/** Host of the isolated app origin for a published slug (CR1). */
export function appOriginHost(slug: string, suffix: string): string {
  return `${slug}.${suffix}`;
}

export type NestedRoute =
  | { kind: "publisher"; username: string }
  | { kind: "app"; username: string; appname: string; slug: string; rest: string }
  | { kind: "detail"; username: string; appname: string; slug: string };

/**
 * Classify a mini-origin pathname whose first segment is a (non-reserved)
 * username. Returns null when the path is not a nested route — the caller
 * falls through to the flat/first-party handling.
 */
export function parseNestedPath(pathname: string): NestedRoute | null {
  const segments = pathname.split("/").filter(Boolean);
  const [first, second, ...tail] = segments;
  if (!first || !USERNAME_RE.test(first) || isReservedWord(first)) return null;
  if (!second) return { kind: "publisher", username: first };
  if (!APPNAME_RE.test(second)) return null;
  const slug = joinPublishedSlug(first, second);
  if (tail.length === 1 && tail[0] === "store") {
    return { kind: "detail", username: first, appname: second, slug };
  }
  return {
    kind: "app",
    username: first,
    appname: second,
    slug,
    rest: tail.length ? `/${tail.join("/")}` : "",
  };
}
