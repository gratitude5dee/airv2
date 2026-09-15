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
  "merchant_url": "https://example.com/checkout",
  "amount_cents": 4299,
  "currency": "usd",
  "context": "The owner requested this exact item and quantity. I verified the merchant identity, checkout URL, currency, and final total of $42.99 on the review page before requesting approval."
}' <kernel_session_id>
```

The control plane re-verifies the quote against the frozen cart session —
it never trusts your numbers alone. A `kernel_quote_unverified` response is
an honest failure: stop and tell the owner what you could verify.

## 3. Owner approval → poll

```bash
air-kernel purchase poll <purchase_id>
```

Poll until `status` is `ready`. The response includes
`aliases.number/cvc/exp_month/exp_year` exactly once. Save them only long
enough to fill the current checkout; a later poll intentionally omits them.

## 4. Fill and submit ONCE

Fill the card fields with the aliases. Immediately before clicking the final
merchant button, claim the one permitted submit attempt:

```bash
air-kernel purchase submit <purchase_id>   # claim BEFORE the click
```

Only after that command succeeds, click the final submit button exactly once
(C30 — never retry, never double-click). Then reconcile:

```bash
air-kernel purchase outcome <purchase_id>
```

If the submit claim fails, do not click. If the process crashes after the
claim, do not click or retry when it resumes; reconcile as an ambiguous
outcome and ask the owner to verify before starting a fresh purchase.

If the page's response is ambiguous (timeout, spinner, unclear error),
report `unknown_outcome` — never invent a success, never resubmit.

## 5. Card setup (owner-side, once)

`air-kernel vault enroll` stages a provider ceremony for the owner — they
open it from the watch card / iMessage link and add a card through
Stripe's UI. `air-kernel vault items` lists enrolled instruments (masked).
Until enrollment completes, propose calls that need a card will answer
with a pending action instead — tell the owner to finish setup.
