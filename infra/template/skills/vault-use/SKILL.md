---
name: vault-use
description: "Log in to sites with saved vault credentials; save secrets"
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

## When the site texts/emails a code instead (no TOTP seed)

Never ask for the code in chat. File a live code request — it sends the
human a vault card where they paste it, then you pop it once:

```bash
OPENAI_BASE_URL="$(grep -m1 '^OPENAI_BASE_URL=' ~/.hermes/.env | cut -d= -f2-)"
BASE="${OPENAI_BASE_URL%/api/gateway/v1}"
curl -fsS -X POST "$BASE/api/browser/otp" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"action":"request","host":"<site.host>"}'
# → {"request_id": "…", "expires_in_s": 240}
```

Poll every ~15 seconds until the state changes:

```bash
curl -fsS "$BASE/api/browser/otp?request_id=<request_id>" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
# pending → keep polling    resolved → {"code":"…"} (exactly once)
# denied  → the human declined; stop and say so
# expired → file ONE new request, then stop if that one lapses too
```

The code is a live credential: type it into the focused field and never
print, store, or repeat it. Cancel a request you no longer need with
`{"action":"cancel","request_id":"…"}`.

## If — and only if — the human connected 1Password

Most people have not. 1Password is optional: it exists only when the human
chose "Bring your own manager" and connected a 1Password account. Check
before assuming it:

```bash
air-vault op-list
# {"error": "op_not_connected", ...}  → they never connected it. Stop:
# use the built-in vault above, and do not mention op again.
```

When it IS connected, you can list their items — names and ids only, never
values — and fill one field at a time. Each listed item carries a
`ref_prefix` built from its opaque 1Password ids (`op://<vault-id>/<item-id>`);
append the field to it. Never build a reference from vault or item names —
the CLI refuses them.

```bash
air-vault op-list              # names/vaults/ids only; never `op item get`
                               # with a field, never `op read` yourself
air-vault op-fill --ref "<ref_prefix>/username"
# focus the password field, then:
air-vault op-fill --ref "<ref_prefix>/password"
```

`op-fill` resolves the value in its own process and delivers it over the same
browser debug channel as `air-vault type`. It obeys the SAME per-site rule:
the human must have turned on "Allow agent sign-in" for that host on that
1Password item, or it refuses with `site_not_granted`. All the hard rules
below apply unchanged.

## Storing a secret the human gave you

When the human pastes you a credential to keep safe (an API key, a Wi-Fi
password, a login you both just made up), it goes into the vault — never into
memory files, notes, or your reply. Storing needs the human's approval, and
the value never travels to the control plane:

1. Write a one-shot apply file yourself inside the protected inbox dir. The
   filename MUST be `~/.hermes/vault/.inbox/agent-<uuid>.json`:

```bash
mkdir -p ~/.hermes/vault/.inbox && chmod 700 ~/.hermes/vault ~/.hermes/vault/.inbox
install -m 600 /dev/null ~/.hermes/vault/.inbox/agent-$(cat /proc/sys/kernel/random/uuid).json
# then write the payload into that file:
# {"version": 1, "operations": [
#   {"op": "create", "item": {"kind": "login"|"api_key"|"note"|"card"|"identity",
#                            "name": "<what the human calls it>",
#                            "fields": {"<field>": "<value>", ...}}}
# ]}
```

2. File the approval with the control plane (box bearer — your default auth):

```bash
curl -fsS -X POST "$BASE/api/vault/fill" \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "<what the human calls it>", "kind": "<same kind>",
       "staging_ref": ".hermes/vault/.inbox/agent-<uuid>.json"}'
# → 202 {"decision_id": "…"}
```

3. Tell the human it's waiting on their approval in Needs-you. Approved, the
   file is applied and shredded; dismissed, it's shredded where it sits.
   If you no longer need the store, shred the file yourself.

Never write the apply file outside `.inbox`, never name it anything but
`agent-<uuid>.json`, and never put the value in the decision payload — the
control plane only ever sees the path.

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
- Never put a credential in a command argument, a note, or a URL. The one
  file a credential may ever occupy is a one-shot apply payload inside
  `~/.hermes/vault/.inbox/` (see "Storing a secret the human gave you") —
  the CLI shreds it on apply.
- If a fill fails repeatedly, hand the human the screen with the
  computer-relay skill; do not improvise another way to get the value in.
