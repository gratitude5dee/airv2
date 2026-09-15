---
name: kernel-payments
description: "Pay through the Kernel vault lane: propose a purchase, owner approves, control plane authorizes, fill aliases, submit once"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Payments, Kernel, Browser, Human-In-The-Loop]
---

# Kernel vault payments

The Kernel lane pays with single-use virtual cards (Stripe AgentCard) or
the owner's Link wallet inside Kernel — real PANs never reach this box or
the model. The control plane verifies every purchase and holds the only
authorize call; the owner approves from the hosted approval card.

The fixed choreography — never reorder or skip:
**you find → you propose → owner approves → control plane authorizes →
you fill aliases → submit once → you report the outcome.**

## 1. Work the cart

Drive the merchant site in a Kernel browser (`kernel-browser` skill,
create with `--vault`). Reach the final checkout review screen — the one
right before the submit button. Do not submit.

## 2. Propose

```bash
air-kernel purchase propose '{
  "merchant_domain": "example.com",
  "merchant_name": "Example Store",
  "amount_cents": 4299,
  "currency": "usd",
  "merchant_amount_cents": 4299,
  "merchant_currency": "usd",
  "item_name": "Item — variant",
  "quantity": 1,
  "checkout_url": "https://example.com/checkout",
  "quote_evidence": ["page text: 'Total $42.99'"]
}' <kernel_session_id>
```

The control plane re-verifies the quote against the frozen cart session —
it never trusts your numbers alone. A `kernel_quote_unverified` response is
an honest failure: stop and tell the owner what you could verify.

## 3. Owner approval → poll

```bash
air-kernel purchase poll <purchase_id>
```

Poll until `status` is `authorized`. While the card alias exists only when
status is `ready` and the purchase is unsubmitted — the response includes
`aliases.number/cvc/exp_month/exp_year` exactly once it is safe to fill.

## 4. Fill and submit ONCE

Fill the card fields with the aliases, submit the checkout exactly once
(C30 — never retry, never double-click), then:

```bash
air-kernel purchase submit <purchase_id>   # marks the submit attempt
air-kernel purchase outcome <purchase_id>  # reconciles charge vs ambiguity
```

If the page's response is ambiguous (timeout, spinner, unclear error),
report `unknown_outcome` — never invent a success, never resubmit.

## 5. Card setup (owner-side, once)

`air-kernel vault enroll` stages a provider ceremony for the owner — they
open it from the watch card / iMessage link and add a card through
Stripe's UI. `air-kernel vault items` lists enrolled instruments (masked).
Until enrollment completes, propose calls that need a card will answer
with a pending action instead — tell the owner to finish setup.
