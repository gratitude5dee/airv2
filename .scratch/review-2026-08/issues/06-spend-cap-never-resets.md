# P1-2: spend_mtd_usd never resets (monthly cap is lifetime cap)

Status: open

Only writer is add_spend(); no period anchor, no cron zeroes it. Fix: spend_period_start column + roll-on-read (pattern in lib/browser/rules.ts:112). entitlements 0001/0002, gateway route:147.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
