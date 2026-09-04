/**
 * MA3: one reserved-word list guarding both directions — a username may not
 * claim a word the store routes by (or a first-party slug), and a published
 * app slug (<username>-<appname>) can never collide with a bare word because
 * it always contains the hyphenated username prefix.
 *
 * V11 (CR15): nested URLs make `mini.wzrd.tech/<username>` a route, so every
 * first segment the mini origin serves itself must be here — a username can
 * never shadow a route. Middleware imports this module (edge runtime): keep
 * it dependency-free.
 */

/** Platform/route words no username may claim. */
const PLATFORM_RESERVED = [
  "_air", "_next", "admin", "air", "api", "app", "apps", "billing", "create",
  "drop", "functions", "help", "login", "mail", "mini", "preview", "publish",
  "root", "security", "store", "support", "system", "team", "wzrd", "www",
];

/** First-party registry slugs (goal.md §MA5–MA8) — bare slugs by design. */
const FIRST_PARTY_RESERVED = [
  "ads", "analytics", "berd", "browser", "buzz", "calendar", "computer",
  "connect", "crm", "feedback", "home", "image", "inbox", "kanban",
  "masterkey", "onboarding", "pay", "persona", "settings", "shop", "todo",
  "vault", "video",
];

export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  ...PLATFORM_RESERVED,
  ...FIRST_PARTY_RESERVED,
]);

export function isReservedWord(word: string): boolean {
  return RESERVED_WORDS.has(word.toLowerCase().trim());
}
