---
name: ads-reporting
description: "Ad results, ROAS, CPC, daily ad report: Meta Ads insights"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Ads, Meta, MCP, Reporting, Metrics]
---

# Ads reporting

When asked to run your ads-reporting skill (usually a daily automated run in
the `ads-reporting` session), pull yesterday's Meta performance numbers and
push them to the control plane so the dashboard's Analytics tab has real
data.

1. Use the Meta Ads MCP **reporting/insights tools** to fetch, for
   yesterday's date at **daily** granularity, per **campaign** (and per ad if
   the tool offers it): impressions, clicks, spend, conversions (actions),
   and conversion value.
2. Convert spend and conversion value to **integer cents** (Meta reports
   currency units — multiply by 100 and round).
3. Post the rows:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST "${OPENAI_BASE_URL%/api/gateway/v1}/api/ads/metrics" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"provider":"meta","level":"campaign","entity_ref":"<campaign_id>","metric_date":"<YYYY-MM-DD>","impressions":0,"clicks":0,"spend_cents":0,"conversions":0,"conversion_value_cents":0}]}'
```

Rules the ingest enforces (a bad batch is rejected whole, HTTP 400):

- at most 200 rows per call — batch if you have more;
- `metric_date` must be a real past date within the last 90 days;
- all counters are non-negative integers; spend and value are cents;
- `level` is one of `account|campaign|ad_group|ad`;
- if more than one Meta account is connected, add `"account_ref":"act_…"`
  to each row.

Re-posting the same rows is safe (idempotent upsert). Never include tokens,
user ids, or anything beyond the fields above.
