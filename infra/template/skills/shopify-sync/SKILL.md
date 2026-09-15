---
name: shopify-sync
description: "Sync the owner's /shop products to their Shopify store and back, with Shopify tokens held in air-vault or 1Password"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Shopify, Commerce, Storefront, Vault]
---

# Shopify sync

The owner's storefront_products table is the source of truth. This skill
pushes/pults products to their Shopify store using an Admin API token kept
in the vault managers — never in files or the environment.

## Token custody (C23)

Resolve the token per call, from whichever manager the owner connected:

```bash
air-vault get shopify_admin_token      # air-vault
op read "op://airv2/shopify/admin_token"  # or 1Password
```

If neither has it, STOP — tell the owner to add the Shopify Admin API
token via onboarding/Settings. Never ask for it in chat.

## Control-plane endpoints (box-auth, use the gateway token)

```bash
# catalog diff: each product with its shopify external ref (or null)
curl -fsS "$BASE/api/commerce/shopify" -H "Authorization: Bearer $TOKEN"

# after creating/updating a Shopify product, record the ref
curl -fsS -X POST "$BASE/api/commerce/shopify" \
  -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"product_key":"my-product","shopify_product_id":"gid://shopify/Product/123","shopify_url":"https://..."}'
```

## Flow

1. `GET /api/commerce/shopify` → the owner's products + refs.
2. For each product without a `shopify` ref: create it via the Shopify
   Admin API (`POST /admin/api/2025-01/products.json`) with name,
   description, price, and the public image URL.
3. For products WITH a ref: update changed fields; re-push when name,
   price, or description changed since the last recorded sync.
4. Record every `shopify_product_id` via `POST /api/commerce/shopify`.
5. Report a plain diff to the owner: created / updated / skipped.

## Rules

- Shopify is outbound distribution — purchases still run through the
  owner's Connect checkout or pay links; never create Shopify draft orders.
- Respect Shopify rate limits; batch `products.json` creates.
- A product unpublished in /shop should be set `status: draft` in Shopify
  (with the ref intact) rather than deleted.
