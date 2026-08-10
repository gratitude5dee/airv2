# air 2.0 — Security decisions

Finalized decisions that refine (never weaken) the constraints in `goal.md` §1 and
`ARCHITECTURE.md` §8. Where wording conflicts, this file records the resolved model.

## Email send model: two permission-scoped keys, one inbox

One AgentMail **pod per user** (`client_id = user_id`), **one inbox per user**, and
**two keys** pointed at that same inbox:

| Key | Scope | Lives | Can |
|---|---|---|---|
| **Box key** | inbox-scoped, **draft-only + read** | injected into the box `env` at fork | compose drafts; read inbound mail (verification codes/links during account creation). Physically **cannot send** — preserves C10 structurally. |
| **Control-plane key** | send-capable | **only** in Vercel server env; never in any box, never `NEXT_PUBLIC_` | the only key that can call `POST /send` / `Send Draft`. |

### Send policy — resolved in the control plane by sender trust tier

The tier is set by the router as trusted metadata the agent cannot read or rewrite:

- **Tier 0 (owner) / Tier 1 (known):** the control plane **auto-sends** the agent's
  draft with no human tap.
- **Tier 2 (unknown):** the draft is **held**; a "Needs you" confirmation card goes to
  the owner; the control plane sends only on the owner's tap.

This refines goal.md's "human approves every draft" wording: approval is still the only
send path that exists (C10 — the box key cannot send), but tier-0/1 approvals are
resolved by policy rather than a tap.

### Hygiene

- Every send carries an `Idempotency-Key`.
- Inbound mail is stripped of quoted history with **Talon** before it reaches the model.

## Email domain

`AGENT_EMAIL_DOMAIN` defaults to AgentMail's free-tier managed domain
(`@agentmail.to` namespace, i.e. `agentmail.com` free tier) for the beta. The
`@wzrd.tech` custom-domain migration is **deferred**.

- **Deferred, not answered:** goal.md §3 Verification Q1 — whether a pod inbox can be
  created on an **org-level** verified domain. This must be tested and reported before
  the wzrd.tech cutover (which requires org-level SPF/DKIM/DMARC). A negative answer is
  a §9 escalation.
- `agent_addresses` retains **every** prior address as a permanent alias (`retired_at`)
  across BOTH username renames AND the future domain migration. The inbound router
  resolves retired addresses forever.

## Dashboard basic-auth credential persisted sealed (CM1 task 0 / CC10 / V7)

`boxes.dashboard_auth` stores the box dashboard's (9119) basic-auth password
sealed with AES-256-GCM under `BOX_DASHBOARD_AUTH_KEY`
(`apps/web/lib/crypto/secretbox.ts`). Previously only a bcrypt-style hash
reached the box and the plaintext was discarded at provision time.

**Why:** the creative plugin (CM1) is a dashboard backend plugin — its routes
are served by the 9119 dashboard behind basic auth, so the allowlisted
`/api/box/*` proxy cannot reach `api/plugins/creative/*` without a credential.

**Bounds:**

- At rest it is ciphertext (`v1:` versioned format); the sealing key lives only
  in the Vercel server env, never in a box or browser. The plaintext exists
  only transiently inside the proxy request handler.
- The proxy uses it only for paths in `DASHBOARD_ALLOWLIST` — exactly the
  creative plugin surface, path by path (C5). No generic dashboard access is
  exposed; every other `/api/plugins/*` path stays 404. Asset **bytes** are not
  browser-proxied at all (server-to-server only, C16).
- Box origins and hosted tokens still never reach a client (C3).
- Rotation: re-provisioning writes a new password + hash; rotating
  `BOX_DASHBOARD_AUTH_KEY` requires resealing rows (the version prefix exists
  for that migration).
- When `BOX_DASHBOARD_AUTH_KEY` is unset, provisioning persists no credential
  and dashboard proxy paths return 503 — the feature fails closed.

## Creative asset delivery — user content leaves the box (CM2 / CC3 / CC4)

Publishing platforms (Meta et al.) fetch media from a public URL; they do not
accept uploads. The box can never be that URL (C16), so rendered assets leave
the box through a delivery layer (`apps/web/lib/assets/`).

**What leaves:** only rendered creative outputs the user explicitly delivers
(`POST /api/assets`), never arbitrary box files — the pull path is exactly
the creative plugin's export endpoints, server-to-server.

**What is done on the way out:** the plugin strips EXIF/GPS/XMP/container
metadata **inside the box** before the bytes leave (CC4; images re-encoded,
av containers stream-copied with metadata dropped), and the control plane
verifies the export's sha256 end-to-end before storing.

**Where it lives:** the private `creative-assets` Supabase Storage bucket,
content-addressed under `<user_id>/masters/…`. Deleting a user removes the
whole prefix in the same deletion script.

**Who can reach it and for how long:** nothing is publicly reachable at rest.
A delivery is a copy at an unguessable random path signed for
`DELIVERY_TTL_SECONDS` (30 min — Meta's worst-case container processing plus
one sweep of retry margin), minted at publish time and deleted on
confirmation or expiry, whichever first — after deletion the URL 404s even
inside its signature window. Bytes are served by object storage directly,
never proxied through a Vercel function.

## Standing invariants (restated for this repo)

- No Box `_token`, `API_SERVER_KEY`, `GATEWAY_TOKEN`, provider key, or `*.on.ascii.dev`
  URL ever reaches a browser (C3/C16).
- Every user fork passes `noEnv: true` (C1); no box holds a model-provider key (C2).
- No message content, memory, or documents in Postgres (C4) — §3.2 test: a datum
  belongs in shared Postgres iff a request that does not yet know the user needs it.
- Webhooks are verified, deduped, and acked **before** work (C8).
- `api_server` is the only enabled Hermes platform (C12).
- Tier-2 senders never cause a mini-app token mint (C15) and never trigger a side
  effect without landing in "Needs you".
