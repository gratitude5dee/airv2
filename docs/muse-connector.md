# Air × Muse

Use Air as the execution and iMessage relay layer for a Muse agent.

- MCP endpoint: `https://muse.wzrd.tech/mcp`
- REST API: `https://muse.wzrd.tech/openapi.json`
- Authentication: OAuth 2.1 authorization code with PKCE for MCP; owner-created,
  revocable `wzrd_muse_…` API keys for the REST facade.

## Access requirements

You need a US mobile number that can receive SMS and iMessage. Sign in with
the phone number that is already your Air identity. If Air recognizes it, the
connection uses your existing Air account. If it does not, Air creates a
phone-bound account after the SMS verification and provisions it from the Air
project: a dedicated Photon/Spectrum iMessage line, a Box, and a WZRDMail
inbox. Your Air iMessage number is shown in Air as soon as provisioning
finishes; send it the first message to establish the iMessage conversation.

New account creation requires an available, project-provisioned **dedicated**
Air line; a pooled `shared` Spectrum route is not presented as a personal
number.
This is a no-payment test phase: no payment is collected during connection,
and the Stripe Link provisioning portal is not enabled yet. Air will show an
availability error instead of buying, upgrading, or charging for a line.

Air applies its own plan limits to work it performs. Muse uses the user's Muse
plan for reasoning. Updates are paused by default only if the owner chooses to
pause them; otherwise they are capped at 30 per day by default and honor the
owner's quiet hours. Availability is limited to supported iMessage regions and
the current US-phone beta.

## What the connector can do

After consent, a Muse agent can:

- send bounded updates through the owner's Air iMessage line;
- receive owner-authored `/muse …` instructions through a pull-based relay;
- inspect the connected Air's safe status; and
- request work from Air only through the capabilities the owner grants.

Air never gives Muse an Air password, a box URL, a phone number, inbox
credential, or wallet credential. Sending, paying, booking, calendar changes,
and schedules remain Air **Needs you** decisions; a Muse request is not an
approval.

## Relay recipe

Create a scheduled Muse agent that periodically calls `air.commands.pull`.
For each returned command, carry out the requested work using the user's
connected services, then call `air.commands.reply` with a short result. End
quietly when no command is returned. Never ask the user for Air credentials.

## Disconnecting

The owner can disconnect Muse from the Air Muse mini-app. This revokes every
Muse OAuth grant and API key immediately. The Air account, project-provisioned
iMessage line, Box, and WZRDMail inbox remain the owner's.
