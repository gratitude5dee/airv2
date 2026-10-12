---
title: Formation — form a US company with your agent
description: /formation walks you from "LLC or C-Corp?" to a filed company, an EIN, a US bank account with a USDC treasury, and stablecoin invoices — with a human click before any money moves.
slug: /docs/formation
---

# Formation

`/formation` is the Air mini-app for company formation and banking. It is built
around Stablecorp (mystablecorp.xyz), the provider every Crypto World's Fair track
lists under "Company formation and banking": Delaware C-Corp or Wyoming LLC from
anywhere in the world, no SSN required, EIN, registered agent, a US business bank
account with a USDC treasury, and invoicing in USDC, EURC, USDT, or fiat.

Air does not file paperwork itself and does not pretend to be counsel. It does what a
good operations person does: asks the right questions once, keeps the packet and the
documents, hands you to the provider with everything pre-filled, stops before the
payment so you click it, and then never lets you miss a deadline.

## What happens, step by step

### 1. Decide

Text `/formation` (or open it from the Apps tab). The first screen is a short
decision guide drawn from Stablecorp's LLC-vs-C-Corp guidance:

- Where do the founders live? (non-US founders usually want a Wyoming LLC unless they
  plan to raise)
- Will you raise from US investors or issue options? (that is a Delaware C-Corp)
- Will the company hold tokens or a stablecoin treasury? (either works; the bank
  account and invoicing are the same)

You get one recommendation with the reasons, and you can override it.

### 2. Intake

Your agent collects the packet over chat, in whatever order you answer:

- Company name and two alternates (it checks availability on the state registry
  from your Box's browser)
- State, entity type, founders (name, residency, email), ownership split
- Registered agent choice (Stablecorp's or your own), mailing address
- EIN needed? Bank account needed? 83(b) election intended?

The packet lives in your Box at `.hermes/miniapps/formation/packet.json`. Nothing is
stored in Air's shared database except the status of the request.

### 3. Hand off

When the packet is complete the mini-app shows exactly what will be submitted and the
provider's price, and asks you to approve the submission. Approval opens Stablecorp's
checkout in your Box's browser. Air's existing purchase stop applies: the agent never
enters a card, and **you** click Pay. No Stablecorp credentials are stored.

Pricing is Stablecorp's and can change. At the time of writing their founding-cohort
pricing is:

| Package | One-time price |
|---|---|
| Wyoming LLC | from $999 |
| Delaware C-Corp | from $1,199 |

Incorporation, banking, stablecoin invoicing, and the first year's compliance are
described as included. Confirm on their checkout page.

### 4. Track

The Formation screen shows four tiles — **Filed → EIN → Bank → Ready** — and your
agent updates them from the emails the provider sends to your Air inbox (you can also
tap them). Documents (formation certificate, EIN letter, bylaws, operating agreement,
RSPAs, cap table) go to your Vault.

Two dates go on your calendar automatically:

- **83(b) election: 30 days from the stock issuance date.** This is a hard IRS
  deadline. Air reminds you at 21, 7, and 2 days.
- **Annual compliance** (Delaware franchise tax and annual report, or the Wyoming
  annual report).

### 5. Run the money

Once the bank account exists, invoicing is just `/pay`:

```
/pay request 2,500 USD from acme@example.com            Stripe Link checkout
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
- Pay the provider on its own. The purchase stop is a hard rule, not a setting.
- Move company money without an approval card.

## Resources

- Stablecorp: https://mystablecorp.xyz
- Form a US company from anywhere: https://mystablecorp.xyz/guides/how-to-form-us-company-from-abroad
- LLC vs Delaware C-Corp for non-residents: https://mystablecorp.xyz/guides/llc-vs-c-corp-non-resident
- 83(b) election guide: https://mystablecorp.xyz/guides/83b-election-guide
- Cap table basics: https://mystablecorp.xyz/guides/cap-table-basics
- US business bank account remotely: https://mystablecorp.xyz/guides/us-business-bank-account-non-resident
- Delaware C-Corp for Solana founders: https://mystablecorp.xyz/guides/delaware-c-corp-formation-guide
- Squads Altitude (treasury): https://altitude.xyz
