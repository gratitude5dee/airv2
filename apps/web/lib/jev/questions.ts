/**
 * Jev (TypeSafe System One) turn-routing contract — the single place to
 * review what the router asks and how answers are applied. One batched
 * /v1/systemone call per turn (speculative fan-out: every question runs
 * over the same state and code consumes only the answers it needs).
 *
 * Tune questions and thresholds here, never inline in the router.
 */

/** Model id on the TypeSafe API (direct key). */
export const JEV_MODEL = "jev-latest";
/** Model slug on the Vercel AI Gateway (`provider/model`). */
export const JEV_GATEWAY_MODEL = "typesafe-ai/jev";

/** A routed capability below this probability is a guess — emit no hint. */
export const ROUTE_MIN_PROBABILITY = 0.55;
/** Gate hints push the agent toward a pending owner decision, so they ask
 * for more certainty than a skill nudge. */
export const GATE_MIN_PROBABILITY = 0.6;
/** Below this noul the turn is treated as self-contained. */
export const CONTEXT_MIN_NOUL = 0.6;

/** Capabilities Jev routes into — box skill leaves/families as installed
 * under ~/.hermes/skills (a family name like `email` covers its leaves),
 * plus `none` for ordinary conversation. */
export const ROUTE_OPTIONS = {
  "kernel-browser":
    "Live website work in a real browser — navigate, click, fill forms, scrape, check prices, shop, buy, reorder, or check out; any errand executed on a website even when it ends in a purchase",
  "kernel-payments":
    "Money movement itself — payment links, invoices, charging a card, spend requests; not website errands",
  "vault-use":
    "Store or retrieve secrets, credentials, ID numbers, or payment cards in the owner's vault",
  watch_for:
    "Arm a persistent watch — restocks, price drops, availability, releases; recurring checks rather than one-off lookups",
  comms:
    "Work the owner's inbox — triage, read, extract, or act on email and message content (not composing outbound mail)",
  "email-draft-review":
    "Compose, reply to, or forward email — anything ending in a draft the owner approves before it sends",
  "calendar-native":
    "Read or write calendar events — schedule, reschedule, check availability, RSVP",
  "openviking-memory":
    "Recall or store durable personal facts, preferences, and notes about the owner",
  "storefront-commerce":
    "Manage the owner's storefront — products, listings, pricing, publishing shop changes",
  "create-miniapp":
    "Build or iterate a mini-app or small web app for the owner",
  "social-engage":
    "Social media work — posts, replies, DMs, engagement",
  "tour-planning":
    "Plan tours, trips, venues, or multi-stop itineraries",
  "onairos-connect":
    "Coordinate with another person's agent, or connect and sync the owner's Onairos persona",
  "crm-people":
    "Look up, add, or update contacts and people records",
  "shopping-checkout":
    "Find products and help the owner shop online",
  "browser-use":
    "General web research or lookups that need a browser but no purchase",
  email: "Read, search, or send from the owner's mailbox — generic email work",
  trade: "Stock or crypto trading, orders, or watchlist changes",
  wzrdmail: "Work in the owner's wzrdmail mailbox",
  none: "Plain conversation, questions, or anything no listed capability covers",
} as const;

export type RouteOption = keyof typeof ROUTE_OPTIONS;

/** Owner-approval gates a turn can end in — the decision kinds the
 * control plane files into Needs-you for the owner. */
export const GATE_OPTIONS = {
  purchase_review: "Buying or paying — owner approves the purchase first",
  email_draft: "Sending email — owner approves the drafted message",
  miniapp_publish: "Publishing a mini-app",
  shop_publish: "Publishing storefront or product changes",
  social_post: "Posting to social media",
  calendar_add: "Adding an externally sourced event to the owner's calendar",
  vault_fill: "Filling a secret or card detail from the vault",
  crm_update: "Writing contact or CRM records",
  none: "No owner approval — read-only or internal work",
} as const;

export type GateOption = keyof typeof GATE_OPTIONS;

/** The one batched question set — every question runs in parallel over
 * the same state; unanswered branches cost nothing downstream. */
export const ROUTING_QUESTIONS = {
  capability: {
    type: "choice",
    instructions:
      "Which single capability should primarily handle this request? Pick the best fit, or none when it is ordinary conversation or a task nothing listed covers.",
    criteria: ROUTE_OPTIONS,
  },
  approval_gate: {
    type: "choice",
    instructions:
      "Which owner-approval gate must this turn end in? Choose none when the request is read-only, conversational, or produces no external side effect.",
    criteria: GATE_OPTIONS,
  },
  needs_owner_context: {
    type: "noul",
    instructions:
      "This request needs the owner's personal context — contacts, calendar, memory, vault, or inbox contents — to be answered correctly.",
  },
  compound_request: {
    type: "noul",
    instructions:
      "This request asks for more than one distinct action (a compound request).",
  },
} as const;
