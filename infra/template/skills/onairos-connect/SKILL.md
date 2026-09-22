---
name: onairos-connect
description: "Connect the owner's Onairos persona and coordinate with other people's agents — contact channels, agent-to-agent asks, scheduling across agents"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Onairos, Coordinate, Channels, Persona]
---

# Onairos connect & coordinate

Two jobs share this surface:

1. **Connect the owner's Onairos persona** — a consent flow that syncs
   their self-described persona onto this box.
2. **Coordinate with other people's agents** — asking Dana's agent when
   she's free, fielding asks from a teammate's agent, standing up the
   channel a team reaches this agent through.

## Know the state before claiming it

- Persona grants are box-side only: `~/.hermes/context/.onairos-spectrum-grants.json`
  holds the granted `grantId`s after connect. Read it — its contents say
  what synced. Never claim a grant, a persona, or a connection you can't
  see in that file.
- The grants file is authorization state, not content: report the count
  and the status, never paste its payload into the transcript.

## Coordinate with another agent

1. Look the person up first (crm-people): the ask rides whatever channel
   their record carries — an iMessage/Spectrum handle, an email address,
   a shared room.
2. Send the ask on that channel, plainly attributed ("<owner>'s agent
   asking: <question>"). Drafts go through the email-draft-review flow
   when the channel is email; shared rooms are posted directly.
3. Report exactly what went out: "asked Dana's agent for her free slots
   next week — waiting on the reply." The other agent's answer hasn't
   happened until it arrives; a hold, booking, or RSVP exists **only
   after** the answer comes back — never write one on expectation.
4. When the reply lands, finish the owner's side: a tentative hold is a
   pending calendar entry via calendar-native, still gated on the other
   side's confirmation.

## A channel where a team reaches this agent

Named bot profiles and rooms are owner-level provisioning — created from
their app (Bots → new channel), not minted by the box. Your part: report
what exists already, take the requests that arrive on it, and point the
owner at the one-tap path when the channel doesn't exist yet.

## Connect the persona

Connect is an owner action from Messages (the Onairos tile); the consent
conversation runs inside their own thread. Relay it — never synthesize
an email, a code, or a YES on their behalf. When a new grantId appears
in the grants file, confirm what synced and what it's for.
