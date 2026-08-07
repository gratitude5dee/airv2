# air 2.0 — Security decisions

Finalized decisions that refine (never weaken) the constraints in `goal.md` §1 and
`ARCHITECTURE.md` §8. Where wording conflicts, this file records the resolved model.

## Email send model: two permission-scoped keys, one inbox

One AgentMail **pod per user** (`client_id = user_id`), **one inbox per user**, and
**two keys** pointed at that same inbox:

| Key | Scope | Lives | Can |
|---|---|---|---|
| **Box key** | inbox-scoped, **draft-only + read** | injected into the box `env` at fork | compose drafts; read inbound mail (verification codes/links during account creation). Physically **cannot send** — preserves C10 structurally. |
| **Control-plane key** | send-capable | **only** in Vercel server env; never in any box, never `NEXT_PUBLIC_` | the only key that can call `POST /send` / `Send Draft`. |

### Send policy — resolved in the control plane by sender trust tier

The tier is set by the router as trusted metadata the agent cannot read or rewrite:

- **Tier 0 (owner) / Tier 1 (known):** the control plane **auto-sends** the agent's
  draft with no human tap.
- **Tier 2 (unknown):** the draft is **held**; a "Needs you" confirmation card goes to
  the owner; the control plane sends only on the owner's tap.

This refines goal.md's "human approves every draft" wording: approval is still the only
send path that exists (C10 — the box key cannot send), but tier-0/1 approvals are
resolved by policy rather than a tap.

### Hygiene

- Every send carries an `Idempotency-Key`.
- Inbound mail is stripped of quoted history with **Talon** before it reaches the model.

## Email domain

`AGENT_EMAIL_DOMAIN` defaults to AgentMail's free-tier managed domain
(`@agentmail.to` namespace, i.e. `agentmail.com` free tier) for the beta. The
`@wzrd.tech` custom-domain migration is **deferred**.

- **Deferred, not answered:** goal.md §3 Verification Q1 — whether a pod inbox can be
  created on an **org-level** verified domain. This must be tested and reported before
  the wzrd.tech cutover (which requires org-level SPF/DKIM/DMARC). A negative answer is
  a §9 escalation.
- `agent_addresses` retains **every** prior address as a permanent alias (`retired_at`)
  across BOTH username renames AND the future domain migration. The inbound router
  resolves retired addresses forever.

## Standing invariants (restated for this repo)

- No Box `_token`, `API_SERVER_KEY`, `GATEWAY_TOKEN`, provider key, or `*.on.ascii.dev`
  URL ever reaches a browser (C3/C16).
- Every user fork passes `noEnv: true` (C1); no box holds a model-provider key (C2).
- No message content, memory, or documents in Postgres (C4) — §3.2 test: a datum
  belongs in shared Postgres iff a request that does not yet know the user needs it.
- Webhooks are verified, deduped, and acked **before** work (C8).
- `api_server` is the only enabled Hermes platform (C12).
- Tier-2 senders never cause a mini-app token mint (C15) and never trigger a side
  effect without landing in "Needs you".
