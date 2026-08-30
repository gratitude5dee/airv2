# Seeded test-mode probe of the approval-staging lanes

The focused run (report.md) created zero decision rows because every money case
stopped to ask for missing context. To separate "agent didn't get there" from
"the staging path is broken", each staging endpoint was called directly with the
eval box's gateway token against a dedicated test account
(user 41d9f7c3-5f2d-485d-a2a9-fd5fc51c27dd, box bx_5xtdsb8m).

## payment_request — works, stays pending

`POST /api/miniapps/commerce {action: "payment_request", currency: "usdc",
amount: "25.00", payee: "0x…dEaD"}` →
`{ok: true, requestId, decisionId}`, and in Postgres:

- `decisions`: kind `payment_request`, status `pending`
- `payment_requests`: status `pending`, `decision_id` set

Nothing moved: no transfer, no checkout session. This is the lane behind the
Link commerce case (F105).

## purchase_review — unreachable on this deployment (schema drift)

`POST /api/browser/purchase {action: "propose"}` returns `no_card`, and
`GET /api/browser/purchase` returns `{"cards": [], "open_review_hosts": []}`
for an account that has a vault card row, because the deployed `vault_items`
table only has:

    id, user_id, name, created_at, default_for_purchases

`kind`, `masked`, `env_var`, `totp_enabled`, `updated_at` and `deleted_at` from
`supabase/migrations/0022_vault.sql` are absent (`supabase_migrations.
schema_migrations` holds only two rows, so the schema was applied ad hoc). Every
card query in `apps/web/lib/vault/purchase.ts` and
`apps/web/app/api/browser/purchase/route.ts` filters on `kind`/`deleted_at`, so
it errors and — because the results are read as `data ?? []` — degrades silently
to "the owner has no cards". Offer-the-fill, and therefore any
`purchase_review` decision, cannot happen until the column set is reconciled.

## email_draft / calendar_add — blocked on inbox provisioning

`PUT /api/settings/username` succeeded but returned `address: null`; AgentMail
rejected inbox creation with `limit_exceeded` (plan limit 3, all consumed).
Without an `agent_addresses` row, `/api/email/drafts/review` answers `no inbox`
(409), so the email-draft gate and the emailed-invite `calendar_add` gate cannot
be exercised on a fresh test account. Needs a freed or additional AgentMail
inbox, not a code change.
