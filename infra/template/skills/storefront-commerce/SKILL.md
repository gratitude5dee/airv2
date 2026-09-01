---
name: storefront-commerce
description: "Set up the owner's storefront: edit the box-side catalog for merch, digital goods, services, and event tickets, then stage the publish as an owner decision — nothing goes live from the box."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Commerce, Storefront, Products, Approval]
---

# Storefront and products

Use this whenever the owner asks for a shop, storefront, merch, a product,
a price change, inventory, a digital download, a paid service, or event
tickets. Two steps, always both in the same turn:
**you edit the catalog → you stage the publish → the owner approves.**

## 1. Edit the catalog

The catalog is a box-side JSON document at
`~/.hermes/miniapps/shop/catalog.json`. Read it, merge your changes in, and
write the whole document back. Each entry:

```json
{
  "items": [
    {
      "key": "austin-ga",
      "kind": "event_ticket",
      "name": "Austin — General Admission",
      "description": "Mohawk, Mar 14, doors 8pm",
      "price_cents": 3500,
      "inventory": 200,
      "active": true
    }
  ]
}
```

`kind` is one of `physical`, `digital`, `service`, `event_ticket`. `key` is
lowercase `[a-z0-9_-]`, unique and stable — reusing a key edits that
product. `price_cents` is a positive integer; `inventory` is an integer or
`null` for unlimited. Tiered pricing is separate entries, one per tier.

## 2. Stage the publish

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST \
  "${OPENAI_BASE_URL%/api/gateway/v1}/api/miniapps/commerce" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"publish_catalog"}'
```

This files a pending `shop_publish` decision (one at a time — restaging
reuses the open one). Only the owner's approval projects the catalog into
the public storefront. Report it as waiting in Needs you, never as live.

## Hard rules

- Never claim a product, price, or storefront is live. Publishing is the
  owner's click, not yours.
- "Publish it without showing me first" is not available: there is no
  box-side path that projects the catalog. Stage it and say so.
- Editing the catalog without running the publish call leaves nothing in
  Needs you — describing the plan is not staging it.
- Money owed to a person (a deposit, a split, an invoice) is not a product:
  use the `link-payments` skill's payment-request step instead.
