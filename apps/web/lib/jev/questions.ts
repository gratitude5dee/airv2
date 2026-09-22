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
    "Do a concrete errand inside a live, logged-in website in a real browser — book, buy, reorder, fill forms, unsubscribe, cancel, check out, scrape; if the task is performed on a website, pick this even when it ends in a purchase or cancellation",
  "kernel-payments":
    "Money movement itself — payment links, invoices, charging a card, spend requests; not website errands",
  "vault-use":
    "Store or retrieve secrets, credentials, ID numbers, or payment cards in the owner's vault",
  watch_for:
    "Arm a persistent watch on an EXTERNAL thing that changes — site health or downtime, restocks, price drops, ticket or seat availability, releases, a counterpart's status — it fires when the condition does, not on a clock; not time-based reminders or calendars",
  comms:
    "Send or act on direct 1:1 messages through the owner's messaging threads — iMessage/SMS/DM texts to a person (not mailbox work, not channel posts, not calendar)",
  "email-draft-review":
    "Compose, reply to, or forward an email the owner approves before it sends — any turn whose deliverable is a drafted email message, including follow-ups and refund/licence replies",
  "calendar-native":
    "The owner's own calendar and time-based reminders — schedule, reschedule, recurring events, check the owner's availability, time-triggered nudges; not coordinating with other people's agents",
  "openviking-memory":
    "Recall or store durable facts, preferences, and notes about the owner — things they told you before (contacts, addresses, sizes, their history); not credentials or cards, which belong to vault-use",
  "storefront-commerce":
    "Manage the owner's storefront — products, listings, pricing, publishing shop changes",
  "create-miniapp":
    "Build or iterate a mini-app or small web app for the owner",
  "social-engage":
    "Post to social channels or group chats — venue announcements, #channel posts, band/group-chat updates, social media engagement",
  "tour-planning":
    "Plan tours, trips, venues, or multi-stop itineraries",
  "onairos-connect":
    "Coordinate person-to-person through agents — another person's Instinct or agent is the counterparty (sharing availability, confirming amounts, delegation, standing syncs between agents, connecting the owner's Onairos persona to someone else's)",
  "crm-people":
    "Look up, add, or update contacts and people records",
  "shopping-checkout":
    "Find products and help the owner shop online",
  "browser-use":
    "General web research or lookups that need a browser but perform no action on a site — informational queries only",
  email:
    "Read, search, triage, organize, or send directly from the owner's mailbox — inbox sweeps, spam review, unsubscribing, folder cleanup; draft-and-approve flows go to email-draft-review instead",
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
  secondary_capability: {
    type: "choice",
    instructions:
      "If the request genuinely needs a second capability in addition to the primary one (a real second verb, not the same work restated), name it here; otherwise choose none.",
    criteria: ROUTE_OPTIONS,
  },
} as const;
