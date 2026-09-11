/** Static Wabi artwork used as the first-party app fallback. */
const FIRST_PARTY_ART = {
  ads: "/app-icons/wabi-v1/ads.png",
  analytics: "/app-icons/wabi-v1/analytics.png",
  berd: "/app-icons/wabi-v1/berd.png",
  browser: "/app-icons/wabi-v1/browser.png",
  buzz: "/app-icons/wabi-v1/buzz.png",
  calendar: "/app-icons/wabi-v1/calendar.png",
  computer: "/app-icons/wabi-v1/computer.png",
  connect: "/app-icons/wabi-v1/connect.png",
  crm: "/app-icons/wabi-v1/crm.png",
  feedback: "/app-icons/wabi-v1/feedback.png",
  home: "/app-icons/wabi-v1/home.png",
  image: "/app-icons/wabi-v1/image.png",
  inbox: "/app-icons/wabi-v1/inbox.png",
  kanban: "/app-icons/wabi-v1/kanban.png",
  masterkey: "/app-icons/wabi-v1/masterkey.png",
  onboarding: "/app-icons/wabi-v1/onboarding.png",
  pay: "/app-icons/wabi-v1/pay.png",
  persona: "/app-icons/wabi-v1/persona.png",
  settings: "/app-icons/wabi-v1/settings.png",
  shop: "/app-icons/wabi-v1/shop.png",
  todo: "/app-icons/wabi-v1/todo.png",
  vault: "/app-icons/wabi-v1/vault.png",
  video: "/app-icons/wabi-v1/video.png",
} as const satisfies Record<string, string>;

export type FirstPartyArtSlug = keyof typeof FIRST_PARTY_ART;

export function firstPartyAppArt(slug: string): string | null {
  return FIRST_PARTY_ART[slug as FirstPartyArtSlug] ?? null;
}

/** Publisher artwork always has priority over the bundled family. */
export function resolveAppArt(
  slug: string,
  publisherUrl?: string | null
): string | null {
  return publisherUrl || firstPartyAppArt(slug);
}

export { FIRST_PARTY_ART };
