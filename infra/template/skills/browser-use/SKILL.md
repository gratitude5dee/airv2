---
name: browser-use
description: "Drive websites with Browser Use CLI 3.0: pipe Python into `box-browser-use` to control this computer's headed Chrome over CDP for multi-step web work."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Browser, Automation, Python, CDP]
---

# Browser Use CLI 3.0

For multi-step web work — navigating flows, filling forms, scraping data,
comparing pages — prefer the Browser Use CLI over long chains of single
browser_* tool calls. It executes Python inside the browser session
(Browser Harness), so loops, retries, and inspection happen in one shot.

## How to run it

Pipe Python into `box-browser-use` from the terminal:

```bash
box-browser-use <<'PY'
new_tab("https://example.com")
print(page_info())
PY
```

`box-browser-use` attaches to THIS computer's headed Chrome (the same
browser the browser_* tools and air-vault use) over CDP, so tabs, logins,
and cookies are shared and the human can watch everything on the desktop
stream. Do NOT start cloud browsers (`start_remote_daemon`) or log in with
`browser-use auth` — this box's browser is the only browser you use.

Useful checks: `box-browser-use --help`, `box-browser-use --doctor`.

## Hard rules

- All shopping/payment work follows the shopping-checkout skill unchanged:
  purchase review approval before any card fill, `air-vault type` for card
  values, and the human ALWAYS clicks the final Place order / Pay / Buy
  button. NEVER script that final submit click with this CLI.
- Card numbers, passwords, codes, and other secrets never appear in the
  Python you run — the vault types secrets straight into the browser.
- Logins, OAuth consents, CAPTCHAs, and 2FA go to the human via the
  computer-relay skill; never script around them.
- Posting publicly in the human's name still requires escalation per your
  standing policy, whether clicked or scripted.
