---
title: Formation — form a US company with your agent
description: /formation walks you from "LLC or C-Corp?" to a filed company, an EIN, a US bank account with a USDC treasury, and stablecoin invoices — with a human click before any money moves.
slug: /docs/formation
---

# Formation

Status: planned — this page describes the `/formation` mini-app as designed. It ships
in its own session after the chain rails; nothing on it is live yet.

`/formation` is the Air mini-app for company formation and banking. It is built
around Stablecorp (mystablecorp.xyz), the provider every Crypto World's Fair track
lists under "Company formation and banking": Delaware C-Corp or Wyoming LLC from
anywhere in the world, no SSN required, EIN, registered agent, a US business bank
account with a USDC treasury, and invoicing in USDC, EURC, USDT, or fiat.

Air does not file paperwork itself and does not pretend to be counsel. It does what a
good operations person does: asks the right questions once, keeps the packet and the
documents, hands you to the provider with everything pre-filled, stops before the
payment so you click it, and reminds you before each deadline.

## What happens, step by step

The mini-app has three screens — **Packet**, **Submit**, and **Status** — and the
steps below run through them in order.

### 1. Decide

Text `/formation` (or open it from the Apps tab). The Packet screen opens with a short
decision guide drawn from Stablecorp's LLC-vs-C-Corp guidance:

- Where do the founders live? (non-US founders usually want a Wyoming LLC unless they
  plan to raise)
- Will you raise from US investors or issue options? (that is a Delaware C-Corp)
- Will the company hold tokens or a stablecoin treasury? (either works; the bank
  account and invoicing are the same)

You get one recommendation with the reasons, and you can override it. The questions
stay inline until an entity type is set; after that the screen is the checklist.

### 2. Intake

Your agent collects the packet over chat, in whatever order you answer:

- Company name and two alternates. The name check is optional — if you looked the
  name up on the state registry yourself, enter the result and it goes in the packet.
- State, entity type, founders (name, residency, email), ownership split (shown as an
  equity bar)
- Registered agent choice (Stablecorp's or your own), mailing address
- EIN needed? Bank account needed? 83(b) election intended?

The packet lives in your Box at `.hermes/miniapps/formation/packet.json`. Air's shared
database holds only the stage of the request (ready, submitted, filed, EIN, bank,
ready to operate) — no names, addresses, or documents.

### 3. Hand off

When the packet is complete the Submit screen shows exactly what will be submitted,
the package and its quoted price, and asks you to approve the handoff. Approval starts
a run on your Box that opens Stablecorp's checkout in a browser your agent drives
(the Kernel cloud browser first; your Box's own browser only if Kernel is
unavailable), pre-types the packet fields, and stops at payment with a Checkout card
— Air's existing checkout handoff. The agent never enters a card; **you** pay on the
provider's page. No Stablecorp credentials are stored. Deny, and the request goes
back to ready.

Pricing is Stablecorp's and can change; the figures below are a marketing snapshot
from early 2026, so confirm on their checkout page.

| Package | One-time price |
|---|---|
| Wyoming LLC | from $999 |
| Delaware C-Corp | from $1,199 |

Incorporation, banking, stablecoin invoicing, and the first year's compliance are
described as included. Crypto World's Fair builders also get Stablecorp's hackathon
perks: 30% off incorporation, priority EIN processing, priority banking KYB, and a
free 30-minute entity setup call. There is no perk code — mention Crypto World's Fair
at checkout. The Submit screen shows this line when the hackathon flag is set.

Plan the calendar honestly: the EIN is the critical path (an SS-4 by fax for founders
without an SSN typically takes one to four weeks without a priority channel), and a
bank account cannot open before the EIN letter exists.

### 4. Track

The Status screen shows four tiles — **Filed → EIN → Bank → Ready** — with the
deadline countdowns, the documents list, and one Money line. Tap a tile to advance
it; your agent can update it for you when a provider email arrives in your Air inbox.
Documents (formation certificate, EIN letter, bylaws, operating agreement, RSPAs, cap
table) are kept in your Box's formation folder
(`.hermes/miniapps/formation/documents/`); the EIN itself goes in your Vault.

Two dates go on your calendar:

- **83(b) election: 30 days from the stock issuance date.** This is a hard IRS
  deadline. Air reminds you at 21, 7, and 2 days.
- **Annual compliance** (Delaware franchise tax and annual report, or the Wyoming
  annual report).

### 5. Run the money

Once the bank account exists, invoicing is just `/pay`:

```
/pay request 2,500 USD                                   Stripe Link checkout (payee entered on the card)
/pay request 2,500 USDC on base                          USDC on Base
/pay request 2,500 USDC on solana                        Solana Pay QR
/pay request 2,500 USD on tempo memo INV-0007            TIP-20 transfer with the invoice number in the memo
```

Every outbound payment from the company wallet is an approval. Squads Altitude is the
treasury option Air lists if you want multi-party approval over the company's
stablecoin balance.

## What Air will not do here

- Draft bylaws, RSPAs, or tax advice. The provider's package includes the documents;
  Air stores and reminds.
- Pay the provider on its own. The checkout stop is a hard rule, not a setting.
- Move company money without an approval card.

## What we document but do not ship yet

Beyond the first release:

- **Name availability from the Box browser.** You enter the registry result yourself.
- **Parsing the provider's status emails deterministically.** Today your agent reads
  them under its skill and updates the tile; you can always tap it yourself.
- **`/formation status` in chat.** `/formation` opens the card; status lives there.

## Resources

- Stablecorp: https://mystablecorp.xyz
- Form a US company from anywhere: https://mystablecorp.xyz/guides/how-to-form-us-company-from-abroad
- LLC vs Delaware C-Corp for non-residents: https://mystablecorp.xyz/guides/llc-vs-c-corp-non-resident
- 83(b) election guide: https://mystablecorp.xyz/guides/83b-election-guide
- Cap table basics: https://mystablecorp.xyz/guides/cap-table-basics
- US business bank account remotely: https://mystablecorp.xyz/guides/us-business-bank-account-non-resident
- Delaware C-Corp for Solana founders: https://mystablecorp.xyz/guides/delaware-c-corp-formation-guide
- Squads Altitude (treasury): https://altitude.xyz

