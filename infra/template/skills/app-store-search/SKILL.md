---
name: app-store-search
description: "Find/open an app in the wzrd.tech app store by keyword"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Search, Apps, Directory]
---

# App store search

mini.wzrd.tech is a public directory of web apps. When the owner asks for
an app — "find me an app that tracks tasks", "is there a shop app?" —
search the directory and hand back the link.

## Search

```bash
set -a; . ~/.hermes/.env; set +a
BASE="${OPENAI_BASE_URL%/api/gateway/v1}"
curl -fsS "$BASE/api/store/search?q=<keywords>" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Each result carries the app's public listing: `name`, `description`, `url`
(the app itself), `detail_url` (its store page), `agent_md` (a plain-markdown
card describing what it does and how it opens), and `gates` — whether it is
password-protected, paid (`x402` with a USDC price), or free.

## Answer

Report the best matches with their `detail_url` links and note any price or
password up front. The owner opens the link themselves — do not try to open,
pay for, or sign into an app on their behalf. If nothing matches, say so;
never invent listings.
