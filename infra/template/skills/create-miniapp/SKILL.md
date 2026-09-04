---
name: create-miniapp
description: "Host a page for your human as a wzrd.tech mini-app (Drop lane): an HTML file, a zip, or a folder becomes a DRAFT at mini.wzrd.tech/<username>/<app-name>. You stage; only the owner makes it live."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Apps, Create, Mini-Apps, Approval]
---

# Create a mini-app (Drop)

Use this when the owner sends an `.html`, `.zip`, or points at a folder and
says any of: **host this**, **put this up**, **make this live**, **share
this as a page**, **turn this into an app**, **give me a link for this**.
Attachments already sit in this Box at `~/.hermes/inbox/<ts>-<name>` — the
message tells you the path. Nothing here uploads anywhere itself: the
control plane pulls the file out of this Box, checks it, and stages it.

Three commands, run with the `terminal` tool (never `execute_code`):

```bash
air-create drop <path> [--name <app-name>] [--title "<display name>"]
air-create status <slug>
air-create publish <app-name>
```

`air-create` is in `~/.hermes/skills/create-miniapp/scripts/`; call it by
that path if it is not on `PATH`.

## 1. Drop

```bash
~/.hermes/skills/create-miniapp/scripts/air-create drop \
  ~/.hermes/inbox/1712345678-index.html --name promo --title "Tour promo"
```

- `--name` is the app name: 1–32 lowercase letters, digits, hyphens. Use the
  owner's word for it ("host this as promo" → `promo`); without one the
  filename is used. Reserved words (`create`, `api`, `admin`, …) are
  rejected — pick another.
- A folder is zipped for you (`python3 -m zipfile`); `index.html` must be at
  its root. A `.zip` is sent as-is. One `.html` becomes the app's
  `index.html`.
- Images and videos are NOT pages. Decline the Drop and offer a public media
  link through `/api/media/publish` instead (the storefront-commerce skill
  shows the call).

The reply is JSON:

```json
{ "slug": "alice-promo", "appname": "promo", "version": "v1712345678901",
  "url": "https://mini.wzrd.tech/alice/promo",
  "preview_url": "https://alice-promo.apps.wzrd.tech/?t=…",
  "findings": [ { "rule": "inline-handler", "severity": "soft",
                  "file": "index.html", "line": 12, "hint": "…" } ] }
```

Then reply with ONE sentence and the draft card on its own line. The card
marker takes the full `slug` from the reply (`<username>-<appname>`), never
the bare app name:

```text
Staged promo as a draft — tap the card to preview it, then say "publish" when it should go live.
[card: app alice-promo]
```

The card is the owner's preview; `preview_url` is for the owner too and only
works from their phone — never paste it into a browser here and never share
it with anyone else. If the card was sent moments ago it is edited in place
automatically; do not send a second one.

Read `findings` before you say anything. **Soft** findings mean the page is
staged but something inside it will not load or work under the mini-app
policy (e.g. an inline `onclick=`, a huge base64 image); tell the owner in
one line each with the fix hint. A non-2xx exit means nothing was staged:
the `error` is a one-line reason (a script loaded from another origin,
`localStorage`, `eval`, a service worker, a missing `index.html`, a
reserved name). Say what it is and what to change. Do not edit the owner's
file to work around it unless they ask.

## 2. Status

```bash
~/.hermes/skills/create-miniapp/scripts/air-create status alice-promo
```

Returns `status` (`draft` or live), `draft`/`live` versions with their
findings, `url`, and `preview_url`.

## 3. Publish — the owner's decision

When the owner says "publish", "ship it", "make it live", run:

```bash
~/.hermes/skills/create-miniapp/scripts/air-create publish promo
```

That files a **Needs-you** decision on their phone. Approving it takes them
to the Publish surface where THEY flip the app live. Reply:

```text
Publish request is waiting for your approval — tap Needs-you to make it live at mini.wzrd.tech/alice/promo.
```

Hard rules — no exceptions:

- MUST NOT say the app is live, is up, or went out until `air-create status`
  shows `"status": "published"`. Staging is not publishing; you cannot
  publish; the owner does.
- MUST NOT open, fetch, or curl `preview_url`, `localhost`, `127.0.0.1`,
  or any port on this machine to "check" the page. Use `findings`.
- MUST NOT rewrite the owner's HTML to silence findings unless asked.
- MUST NOT paste a raw link instead of the card; the card carries the
  owner-scoped signed link.

Bad: "Done — your page is live!" right after `drop` ✗ · opening
`preview_url` in the Box browser ✗ · "I removed the analytics script for
you" without being asked ✗

Good: `drop` → one sentence + `[card: app <slug>]` (the `slug` field, e.g.
`alice-promo`), findings summarized,
then wait for the owner's word before `publish`. ✓

Vibe (build it for me from a sentence) is not in this version: if the owner
describes a page instead of sending one, say you can host a file or folder
they give you today.
