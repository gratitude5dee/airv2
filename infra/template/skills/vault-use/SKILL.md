---
name: vault-use
description: "Sign in to websites with the human's vault: type credentials straight into the browser with air-vault, never through chat or your own output."
version: 1.1.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Vault, Browser, Login, Security]
---

# Using the vault

The vault on this computer holds your human's credentials. You USE them —
you never READ them. The values must never appear in your replies, your
terminal output, your notes, or anywhere you can see them.

## Signing in to a site

1. Find the item id: `air-vault list --masked` (metadata only — names,
   masked tails, ids; never values).
2. Open the site's login page in YOUR browser (browser tools) and click the
   username or password field so it has focus.
3. Fill the focused field without ever seeing the value:

```bash
air-vault type <item-id> --field username
# click/tab to the password field, then:
air-vault type <item-id> --field password
```

The CLI resolves the value in its own process and delivers it directly into
the focused input over the browser's debug channel. On success it prints only
`typed <item>/<field> into <host>` — that line is all you will ever see.

4. If the site asks for a 2FA code and the item has TOTP enabled, focus the
   code field and run:

```bash
air-vault totp <item-id> --type
```

## If — and only if — the human connected 1Password

Most people have not. 1Password is optional: it exists only when the human
chose "Bring your own manager" and connected a 1Password account. Check
before assuming it:

```bash
air-vault op-fill --ref "op://<vault>/<item>/password"
# {"error": "op_not_connected", ...}  → they never connected it. Stop:
# use the built-in vault above, and do not mention op again.
```

When it IS connected, you can list their items — names and ids only, never
values — and fill one field at a time:

```bash
air-vault op-list              # names/vaults only; never `op item get`
                               # with a field, never `op read` yourself
air-vault op-fill --ref "op://Private/GitHub/username"
# focus the password field, then:
air-vault op-fill --ref "op://Private/GitHub/password"
```

`op-fill` resolves the value in its own process and delivers it over the same
browser debug channel as `air-vault type`. It obeys the SAME per-site rule:
the human must have turned on "Allow agent sign-in" for that host on that
1Password item, or it refuses with `site_not_granted`. All the hard rules
below apply unchanged.

## When the CLI refuses

- `op_not_connected` — the human has no 1Password account connected. Do NOT
  ask them to run `op signin` or install anything; use the built-in vault, or
  tell them 1Password is connectable from the Vault tab if they want it.
- `site_not_granted` — the human has not allowed agent sign-in for this site.
  Do NOT retry or work around it. Tell them to flip "Allow agent sign-in" for
  that login in the Browser tab's Site access panel, then try again.
- `fill_ticket_required` — card/payment fields need an approved fill ticket,
  which arrives with the shopping flow (V6). Never type card numbers by any
  other means; ask the human to complete payment via the relay instead.
- `browser_unreachable` / `no_page` — make sure the headed browser is open on
  the page that needs the credential, then retry once.

## Hard rules

- Never print, echo, copy, or store a vault value. `air-vault get --reveal`
  exists for the human's reveal UI, not for you — do not run it. The same
  goes for `op read` / `op item get --reveal`: only `air-vault op-fill` may
  touch a 1Password value.
- Never paste a credential into chat, even if the human asks you to. Point
  them at the Vault tab's reveal button instead.
- Never put a credential in a command argument, a file, a note, or a URL.
- If a fill fails repeatedly, hand the human the screen with the
  computer-relay skill; do not improvise another way to get the value in.
