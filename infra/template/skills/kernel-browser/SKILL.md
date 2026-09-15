---
name: kernel-browser
description: "Drive the owner's Kernel cloud browser for errands: create a session via air-kernel, relay CDP locally, use the normal browser_* tools"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Browser, Errands, Cloud, Kernel]
---

# Kernel cloud browser

Errands that need a real logged-in browser without tying up the owner's
desktop run in a Kernel cloud browser. The control plane owns the Kernel
API key; this box only ever sees a session handle.

## Choreography

```bash
air-kernel browser create --purpose errand --url https://example.com
# → writes ~/.hermes/kernel/session.json (0600, contains the remote CDP
#   bearer URL — never print it, never pass it as an argument)
air-kernel relay &          # foreground; keep it running for the session
# now the normal browser tools work unchanged:
agent-browser --cdp 9222 <commands...>
```

`agent-browser --cdp <port>` attaches to the relay, which forwards to the
remote browser. Everything the browser_* tools already enforce — including
the lease guard — applies unchanged. The owner can watch live in the watch
mini-app; if they take control, the guard pauses you (C31): every command
fails closed until they hand control back. Do not retry in a loop — wait,
and if the task is time-sensitive tell the owner.

When done:

```bash
air-kernel browser end <session_id>   # from the create response
```

Always end sessions you created. They auto-expire, but ending is free and
immediate.

## Rules

- One session per errand; end it when the errand ends.
- `cdp_ws_url` is a credential. It lives in `session.json` only — never
  echo it, commit it, or pass it on a command line.
- `--vault` on create attaches the owner's Kernel vault (see
  kernel-payments). Only attach it when the errand may pay.
- If `air-kernel browser create` fails with a gateway error, the Kernel
  lane is off for this owner — fall back to the local browser flow and say
  so plainly.
