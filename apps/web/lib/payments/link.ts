/**
 * Stripe Link preference for the browser purchase stop (MA6 #5).
 *
 * Session B's Stripe module (lib/payments/stripe.ts, goal.md §MA2) owns the
 * real host-supports-Link lookup; until it lands this stays behind a feature
 * flag with an env allowlist so nothing here is reachable in production.
 * Wiring a real provider is a one-line swap in `linkProvider`.
 *
 * The stop-before-submission invariant is untouched either way: choosing
 * Link means NO card fill (no ticket is ever minted) — the owner completes
 * the merchant's Link flow in the headed browser themselves.
 */

export interface LinkProvider {
  hostSupportsLink(host: string): Promise<boolean>;
}

function linkEnabled(): boolean {
  return process.env["STRIPE_LINK_ENABLED"] === "1";
}

/** Env-allowlist stand-in until lib/payments/stripe.ts (Session B) lands. */
const envAllowlistProvider: LinkProvider = {
  async hostSupportsLink(host: string): Promise<boolean> {
    return (process.env["STRIPE_LINK_HOSTS"] ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase().replace(/^www\./, ""))
      .filter(Boolean)
      .includes(host);
  },
};

const linkProvider: LinkProvider = envAllowlistProvider;

/** Whether the purchase review card should offer "Pay with Link". */
export async function hostSupportsLink(host: string): Promise<boolean> {
  if (!linkEnabled()) return false;
  try {
    return await linkProvider.hostSupportsLink(host);
  } catch {
    return false;
  }
}
