/**
 * MA3: one reserved-word list guarding both directions — a username may not
 * claim a word the store routes by (or a first-party slug), and a published
 * app slug (<username>-<appname>) can never collide with a bare word because
 * it always contains the hyphenated username prefix.
 */

/** Platform/route words no username may claim. */
const PLATFORM_RESERVED = [
  "admin", "air", "api", "app", "apps", "billing", "help", "login", "mail",
  "mini", "publish", "root", "security", "store", "support", "system",
  "team", "wzrd", "www",
];

/** First-party registry slugs (goal.md §MA5–MA8) — bare slugs by design. */
const FIRST_PARTY_RESERVED = [
  "ads", "analytics", "browser", "calendar", "computer", "connect", "crm", "image",
  "inbox", "kanban", "onboarding", "pay", "settings", "shop", "todo",
  "vault", "video",
];

export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  ...PLATFORM_RESERVED,
  ...FIRST_PARTY_RESERVED,
]);

export function isReservedWord(word: string): boolean {
  return RESERVED_WORDS.has(word.toLowerCase().trim());
}
