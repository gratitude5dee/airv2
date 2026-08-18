/**
 * Per-profile Hermes client (V7). A bot is a Hermes profile on the user's ONE
 * box; the multiplexing gateway serves it under /p/<name>/ with the profile's
 * own API_SERVER_KEY (never the box default key). This module is a thin
 * parameterization of lib/hermes/client.ts: botTarget() rebases the hosted URL
 * onto the /p/<name> prefix and swaps in the per-bot key, and every bot call
 * goes through the resulting target. Both secrets stay server-side (C3).
 */
import type { HermesBoxTarget } from "../hermes/client";

/**
 * Canonical per-bot conversation title — the exact session shape Hermes'
 * bot-mode probe recognizes (tools/bot_mode_probe.py BOT_CHAT_TITLE). One
 * persistent pinned session per bot; no /new.
 */
export const BOT_CHAT_TITLE = "Bot Chat";

/** Deterministic id for the canonical session inside a bot's profile. */
export const BOT_CHAT_SESSION = "bot-chat";

/** Profile names: [a-z0-9-]{2,32}; 'default' is the box's own agent. */
export const BOT_NAME_PATTERN = /^[a-z0-9-]{2,32}$/;

/** 'default' is the box's own agent; 'rooms' is an /api/bots route segment. */
const RESERVED_NAMES = new Set(["default", "rooms"]);

export function isValidBotName(name: string): boolean {
  return BOT_NAME_PATTERN.test(name) && !RESERVED_NAMES.has(name);
}

/**
 * Rebase a box target onto a bot's profile: /p/<name> path prefix plus the
 * bot's own API_SERVER_KEY. The hosted `_port_auth` route token is shared —
 * it authenticates the tunnel, not the profile.
 */
export function botTarget(
  box: HermesBoxTarget,
  name: string,
  apiServerKey: string
): HermesBoxTarget {
  if (!BOT_NAME_PATTERN.test(name)) {
    throw new Error(`invalid bot profile name`);
  }
  return {
    hostedUrl: `${box.hostedUrl}/p/${name}`,
    hostedToken: box.hostedToken,
    apiServerKey,
  };
}
