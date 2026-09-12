---
name: trade
description: "Crypto trading on the owner's Coinbase: balances, prices, staging orders for owner approval, price watches — never executes trades"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Trading, Coinbase, Human-In-The-Loop]
---

# Trade

The owner can buy and sell crypto on their Coinbase account. **You can only
ever stage an order** — the owner approves it on their side, and only then
does the control plane send it to the venue. There is no path around this;
do not look for one. Spot only: no leverage, margin, futures, perps,
swaps, transfers, or withdrawals — if asked for any of those, decline
plainly and say trading is spot buy/sell with owner approval.

Everything goes through the control plane. Never touch a Coinbase key
directly — the box holds none, and must never be handed one.

```bash
# The control-plane base URL is derived from the inference gateway env.
# Read it as data; never execute the environment file.
OPENAI_BASE_URL="$(grep -m1 '^OPENAI_BASE_URL=' ~/.hermes/.env | cut -d= -f2-)"
OPENAI_API_KEY="$(grep -m1 '^OPENAI_API_KEY=' ~/.hermes/.env | cut -d= -f2-)"
BASE="${OPENAI_BASE_URL%/api/gateway/v1}"
TRADE="curl -fsS $BASE/api/trade -H \"Authorization: Bearer $OPENAI_API_KEY\""
```

## The fixed choreography — never reorder or skip a step

**you preview → the owner approves the exact order → the control plane
executes.** A preview expires in 5 minutes; an expired preview is dead, not
retryable — just take a fresh one.

### 1. Preview first, always

```bash
$TRADE -H "Content-Type: application/json" -d '{
  "action": "preview",
  "order": {"productId": "BTC-USD", "side": "BUY", "type": "market", "quoteSize": "50"}
}'
```

Market buys size in quote dollars (`quoteSize`); market sells and
limit/stop-limit orders size in base units (`baseSize`) plus `limitPrice`
(and `stopPrice` + `stopDirection` up/down for stop-limit). The response is
a signed `previewToken` bound to the exact order — you cannot change a
single field without a new preview.

### 2. File the approval

```bash
$TRADE -H "Content-Type: application/json" -d '{
  "action": "propose",
  "order": {"productId": "BTC-USD", "side": "BUY", "type": "market", "quoteSize": "50"},
  "previewToken": "<token from step 1>",
  "note": "what you told the owner this was for"
}'
```

This files a Needs-you decision and sends the owner an approval card.
Tell the owner the order is waiting for their tap — then stop. Do not
poll for the result; the approval lands out of band. Only one approval can
be pending at a time (a second `propose` fails with `pending exists`).

### 3. Reads are free — approvals are not

Balances and prices are private reads and need no approval:

```bash
$TRADE                                          # portfolio (GET ?resource=balance)
$TRADE?resource=orders&scope=open               # open orders
$TRADE?resource=orders                          # recent orders
$TRADE?resource=products&q=SOL                  # product lookup
```

(In practice, set the query inline:
`curl "$BASE/api/trade?resource=orders&scope=open" -H "Authorization: Bearer $OPENAI_API_KEY"`.)

### 4. Cancels need approval too

```bash
$TRADE -H "Content-Type: application/json" -d '{"action":"cancel","ref":"<venue order id or \"last\">"}'
```

### 5. Price watches

```bash
$TRADE -H "Content-Type: application/json" -d '{"action":"watch","symbol":"SOL","op":">","price":"200"}'
$TRADE -H "Content-Type: application/json" -d '{"action":"unwatch","symbol":"SOL"}'
curl "$BASE/api/trade?resource=watch" -H "Authorization: Bearer $OPENAI_API_KEY"
```

Armed watches tick once a minute while this box is awake and text the owner
when a price crosses.

## Hard rules

- **Never present a preview as executed.** `preview` is a quote; nothing
  moved. `propose` files an approval; nothing moved. Only the owner's tap
  moves anything, and the ledger row lands in `orders`.
- If the owner hasn't connected a Coinbase key (Settings → Trade), reads
  and orders run in **paper mode** — simulated fills at real prices. Say
  so when reporting results.
- An uncertain venue response is terminal: the order is marked `uncertain`
  and must never be resubmitted. Report it as "Coinbase didn't confirm;
  check your ledger before retrying by hand."
- `/trade` in chat already handles the simple arms (`/trade portfolio`,
  `/trade watch SOL > 200`, `/trade orders`, `/trade cancel`, `/trade
  paper|live|connect`) without waking this box. Use this skill for the
  rest: freeform requests like "buy $50 of BTC", questions that need
  judgment, and anything combining trades with other work.
