---
name: onairos-spectrum-connect
description: Connect existing Onairos users from a Spectrum message thread and receive their authorization grants inline, from any backend.
---

# Onairos + Spectrum — Connect Onairos skill

Let people connect their Onairos account and authorize your app from inside a Spectrum
message thread. Your backend relays each message between Spectrum and Onairos. Onairos
runs the email, verification, and consent conversation and returns the grants inline.

Works with any backend. You need one API key, kept server-side only:
  - Onairos developer API key

## The loop

On every inbound Spectrum message:
  1. Forward the message to Onairos (the single endpoint below).
  2. Send the "reply" it returns back into the same Spectrum conversation.
  3. When the response contains "grants" (the user replied YES), your app is
     authorized — the grant records are already in that response.

Never send the email, verification code, or YES/NO yourself. Those must come from the
user's own messages — that is what keeps consent with the user.

## The endpoint — relay a message

    POST https://api2.onairos.uk/integrations/spectrum/text/command
    x-api-key: YOUR_ONAIROS_API_KEY
    Content-Type: application/json

    {
      "sessionId": "spectrum_space_id",
      "channel": "iMessage",
      "user": { "id": "message_sender_id_or_phone", "phone": "+15551234567" },
      "message": { "text": "Connect Onairos" },
      "metadata": {
        "agentId": "agent_or_app_id",
        "agentName": "Your App",
        "linkPage": true
      }
    }

Optional metadata: "linkPage": true opens the hosted connect page directly at
sign-in for new users; "allowedPlatforms": ["YouTube", "Reddit"] narrows the
connector list; "returnUrl" (registered domains only) sends the user back to
your app after connecting.

Response — send "reply" back into the Spectrum conversation:

    {
      "success": true,
      "action": "connect_account",
      "reply": "What email is on your Onairos account?",
      "onairos": {
        "flowActive": true,
        "shouldRouteNextMessage": true
      }
    }

While "onairos.shouldRouteNextMessage" is true, keep routing that conversation's
messages to Onairos.

After the user verifies and replies YES, the response carries the grants inline:

    {
      "success": true,
      "action": "authorize",
      "reply": "Authorized Your App to use your connected Onairos accounts.",
      "grants": [ { "grantId": "pta_abc123", "status": "active" } ]
    }

There is no exchange endpoint on Spectrum. The grant records in this response are the
authorization — store them server-side.

## Rules

  - Consent only counts when it arrives in the user's own YES message.
  - Keep the API key on the backend. Never put it in client code or message text.
  - Use a stable sessionId and sender ID on every message of a conversation.
  - Route messages to Onairos while shouldRouteNextMessage is true.

## In this repo

Implemented in `apps/web/lib/onairos/spectrum.ts` and wired into the inbound
iMessage webhook (`apps/web/app/api/inbound/imessage/route.ts`): owner-tier
messages saying "connect onairos" (or arriving while the flow is active) are
relayed to Onairos instead of the agent; the flow flag is connections-table
metadata (provider `onairos`, toolkit `spectrum`) and grant records land
box-side only (C4).
