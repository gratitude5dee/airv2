buzz.goal.md — build spec for the Buzz mini-app (self-hosted Buzz community control surface in Air)

Read `goal.md` and `ARCHITECTURE.md` in full before starting. Where this file and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins and this file is the bug.

Goal: a full-functionality, self-hosted mini-app version of **Buzz** — `mini.wzrd.tech/buzz` — from which the owner manages their Buzz agents and community from inside Air: channels, threads, DMs, canvases, workflows, and the agents that live in those rooms as members. Buzz's model is *relay-as-workspace*: a community is the workspace a user reaches by URL, the relay URL is authoritative for the workspace, and every message, reaction, workflow step, approval, and git event is a signed Nostr event in one log — whether the author is a person or a process (`gratitude5dee/buzz` `README.md`, `VISION.md`).

The hard part is not the UI: it is that Buzz identity is a **keypair**. `BUZZ_PRIVATE_KEY` signs NIP-98 requests. A mini-app runs in a browser on a shared-origin cloud host. Therefore, stated before anything else and non-negotiable: **no private key is ever placed on a command line, in an environment the browser can read, in a document, in a log, or in this repository's Postgres.** Mirror of C18, and the same rule Buzz states for itself ("Never read or echo the value", "never put a private key on a git command line").

0. What already exists — audit before you write code
Do not rebuild any of this. Extend it.

| Subsystem | Where | State |
|---|---|---|
| Mini-app module contract | `apps/web/lib/miniapps/apps/types.ts` | Live. `MiniAppModule { render, action?, guestActions?, publicAccess? }`, `MiniAppContext { request, supabase, app, session, basePath }`; the session arrives already verified. |
| Module registry | `apps/web/lib/miniapps/apps/index.ts` | Live. `FIRST_PARTY_MODULES` slug → module; one line per new app. |
| Registry table + parser | `supabase/migrations/0007_miniapps.sql` (+0034 era columns), `apps/web/lib/miniapps/registry.ts` | Live. `kind`, `visibility`, `access`, `plugin_signin_enabled`, `status`, `bundle_version` all already exist. A new app is a row. |
| Loader + gate chain | `apps/web/app/mini/[app]/route.ts` | Live. slug → row (404 unless `published`) → visibility → password → x402 → session → dispatch; claims authorize, not the path (MA2). |
| Box-side app state | `apps/web/lib/miniapps/store.ts` `readAppState`/`writeAppState` → `.hermes/miniapps/<app>/<resource>.json` | Live. The C4 pattern: agent tools and the view share one file. |
| Connect pattern (auth model to copy) | `apps/web/lib/miniapps/apps/connect.tsx`, `lib/connectors/manage.ts` | Live. Owner-only server-HTML, status chips, `beginConnect` → hosted link with `callback = externalOrigin(request) + basePath`, sync-on-render for pending, disconnect, `forbidden` for unknown actions. The browser sees names and statuses; never a credential. |
| Vault | `lib/vault/*` (box-side encrypted store, Postgres metadata mirror, reveal rules C18/C20, scrubber) | Live. **This is where a Buzz key handle belongs** if one is stored at all — box-side, never in a table, never revealed to a reduced-trust surface. |
| Prompt bar | `apps/web/lib/miniapps/promptBar.ts` | Live. Owner-only Hermes turn with `{app, resource}` metadata; the view re-reads state after (MA10). |
| Decisions / Needs-you | existing `decisions` lane | Live. Anything that should not happen unilaterally is a decision. |
| **Buzz** — product model | `gratitude5dee/buzz` `README.md`, `VISION.md` | Reference. Community = workspace reached by URL; single-relay setup ⇒ the relay URL selects exactly one community; all tenant-observable state under that URL is community-local. Surfaces: Home, Stream (channels/threads), Forum, DMs (up to 9), Agents directory, Workflows (YAML-as-code, approval gates), Search. Access control is enforced by the relay; **channel membership is the only gate**; guests get scoped tokens. |
| **Buzz** — agent surface | `crates/buzz-cli/README.md`, `desktop/src-tauri/src/managed_agents/nest_skill.md` | Reference. `buzz` is the agent-first CLI, JSON in/JSON out, exit codes `0=ok,1=user,2=network,3=auth,4=other,5=write conflict`. Auth env: `BUZZ_PRIVATE_KEY` (NIP-98 Schnorr signing), `BUZZ_RELAY_URL` (default `http://localhost:3000`), `BUZZ_AUTH_TAG` (**required** for `agents draft-create`/`draft-update`). Groups: `messages` (send/send-diff/edit/delete/get/thread/search/vote), `channels` (list/get/create/update/topic/purpose/join), `dms`, `reactions`, `users` (profile/presence/status), `workflows` (list/trigger/approve), `canvas` (get/set), `mem`, `repos`, `agents`. |
| **Buzz** — agent management | `nest_skill.md` §Conversational Agent Management | Reference, and binding: `buzz agents draft-create --channel <uuid> --display-name … --system-prompt …` and `buzz agents draft-update --channel <uuid> --agent-name … …` send an **encrypted owner-reviewed draft to the owner's Desktop**. They return `{request_id, action, saved: false}`. The agent is *not created* until the owner reviews and saves the form — report "ready for review", never "created". New agents default to **Only me**. |
| **Buzz** — architecture rules | `AGENTS.md` | Reference. Nostr-first: prefer a new event kind over a new HTTP endpoint; agent-facing operations belong in `buzz-cli`; the relay's HTTP surface is narrow (NIP-11/NIP-05, `POST /events`, `POST /query`, `POST /count`, workflow webhooks, Blossom media, git smart HTTP, health) and every path preserves the host-derived community boundary. |

1. Hard constraints

| # | Constraint as it applies here |
|---|---|
| C18 (the one that shapes the design) | `BUZZ_PRIVATE_KEY` never appears on a command line, in `argv`, in a process listing, in the mini-app HTML, in the box document, in a log line, or in Postgres. Signing happens where the key already lives. This surface deals in **handles**, npubs, and statuses. |
| C2 | No model-provider key in a box, and no Buzz key material minted or stored by the control plane. |
| C4 | Channels, messages, canvases, drafts, and agent definitions live in the box document / on the relay. Postgres holds only routing metadata: `(user_id, relay_url, community_label, npub, status, paired_at, last_seen_at)`. Never a message body, never a key, never a canvas. |
| C5 | The relay URL is user-supplied ⇒ it is validated (https/wss, no private/loopback ranges from the control plane, no redirects) and recorded per user; egress goes through the allowlist lane, not a raw `fetch` in a renderer. |
| C9 | Relay content is hostile input. Message bodies, channel names, agent display names, and canvases are escaped on render and never interpolated into a command, a URL, or an envelope unquoted. Trust tiers apply to inbound relay content exactly as they do to email. |
| MA1 | `mini.wzrd.tech/buzz` shares no cookie, storage, or session with `air.wzrd.tech`. A Buzz sign-in here is its own thing entirely. |
| MA2/MA4/MA5 | Path is routing; claims authorize. `access='single'`, owner-only, no guest surface (`guestActions` empty). Every gate server-side. |
| MA10 | The agent never learns the Buzz mini-app exists. It reads/writes `.hermes/miniapps/buzz/<resource>.json` and runs `buzz` where the key already is; the view renders that state. |
| Buzz's own contract | Agent creation/update is **owner-reviewed drafts only** (`draft-create`/`draft-update`, `saved: false`). This mini-app never claims to have created an agent and never simulates the review step. |

2. Auth: draw from existing auth, or re-sign-in
The Air owner session identifies the **person**; it says nothing about their Buzz identity. Binding to a community therefore has two paths, and the choice is made by what already exists — the same shape as `connect.tsx`:

**(a) Draw from existing auth.** If the user already has a Buzz identity reachable *without* the browser touching a key, use it:
1. **Box-side signer (preferred).** The user's box already runs their Buzz tooling with `BUZZ_PRIVATE_KEY` in the box environment (or in the box-side vault, unwrapped only inside the box). The mini-app posts an *intent* to the control plane, which runs the corresponding `buzz` command **in the box** — where the key already is, injected as an env var by the box's own harness, never as an argv value. The mini-app learns only the JSON result.
2. **Paired Buzz Desktop.** If the user runs Buzz Desktop, the same device-pairing/outbound-envelope shape as `berd.goal.md` §3.1 applies: Desktop pulls signed, expiring, single-use envelopes and executes them locally with its own key. Nothing inbound, nothing shared.
In both cases the mini-app renders `● connected · <community label> · <npub short>` and acts immediately: no second login.

**(b) Re-sign-in (bind a community).** With no signer available, the view shows `○ not connected` and one action, `Connect Buzz`, which collects only non-secret binding inputs:
- `relay_url` (the community — validated per C5; Buzz's rule is that the URL *is* the workspace, so this is the tenant selector);
- an identity choice: **use my box signer** (a key already present box-side / in the box vault), **pair Buzz Desktop** (device-code flow, the key stays on the desktop), or **NIP-46 remote signer** (`bunker://…` handle: the mini-app holds a *connection handle*, the key stays in the user's signer).
A NIP-98 challenge is then signed by whichever signer was chosen, and the control plane records only `(user_id, relay_url, npub, signer_kind, status)`. There is deliberately **no "paste your nsec" field anywhere in this product.** If a user has nothing but a raw nsec, the flow tells them to place it in their box vault (existing vault UX, box-side encryption, C18 reveal rules) — the mini-app never accepts it in a form.

`plugin_signin_enabled = true` on the registry row governs headless plugin sessions (`goal.md` §MA2.4); it is not a second auth system.

3. How commands actually run
One rule: **the process that holds the key builds and signs the request.** The mini-app produces validated *intents*; a signer executes them.

```
intent := { id, user_id, issued_at, expires_at (≤120s), single_use: true,
            group: "channels"|"messages"|"dms"|"agents"|"workflows"|"canvas"|"users",
            verb: "<allowlisted>", args: <validated JSON>, sig }
```
- **Box signer path:** the control plane runs the `buzz` CLI in the user's box through the existing box command lane, with `BUZZ_RELAY_URL` and `BUZZ_AUTH_TAG` set as env vars and `BUZZ_PRIVATE_KEY` supplied by the box's own environment/vault unwrap — **env, never argv** (argv is world-readable in a process list; this is the concrete reason). Long content (`--content -`, `--system-prompt`) is passed on **stdin**, not as a flag value, which also keeps hostile content out of shell quoting (C9).
- **Desktop signer path:** the envelope is pulled outbound by paired Buzz Desktop, which executes it with its own key and returns JSON.
- **Remote signer path (NIP-46):** the control plane builds the unsigned Nostr event / NIP-98 header, the remote signer signs, the control plane submits it to the relay's narrow HTTP surface (`POST /events`, `POST /query`). This is the only path where the control plane touches the relay directly, and it holds no key at any point.
- Results are normalized (`{event_id, accepted, message}`, ids on creates, exit code semantics including `5 = write conflict → re-read and retry once`) and merged into the box document, which is what the view renders.

4. The mini-app
4.1 Module contract
- New module `apps/web/lib/miniapps/apps/buzz.tsx` exporting `export const buzz: MiniAppModule`, server-HTML via `renderShell`/`shellHtml`, patterned on `connect.tsx`.
- Registered in `apps/web/lib/miniapps/apps/index.ts` (import + one `FIRST_PARTY_MODULES` entry).
- Owner-only: `render` and `action` return `forbidden("this view is owner-only")` for non-owner roles; unknown or malformed actions return `forbidden`.
- Registry row via a new `supabase/migrations/` entry (next free number): `slug='buzz'`, `route='/mini/buzz'`, `kind='render'`, `visibility='private'`, `access='single'`, `status='published'`, `plugin_signin_enabled=true`, `scopes='{buzz:manage}'`, plus `CardKind`/`card_sends`/`miniapp_card_sessions` extension if the agent may send a Buzz card.
- Helper lane `apps/web/lib/miniapps/buzz/`: `state.ts` (document + normalizer), `link.ts` (community binding, signer kind, pairing), `commands.ts` (verb allowlist + arg validation + stdin routing). No relay `fetch` from the module itself (`goal.md` §7).

4.2 Box-side state — `.hermes/miniapps/buzz/<resource>.json`
A cache plus intent; the relay is authoritative.
```ts
interface BuzzDoc {
  schemaVersion: 1;
  title: string;
  link: { status: "unbound" | "pending" | "connected" | "revoked";
          relayUrl: string | null;          // the community
          communityLabel: string | null;    // NIP-11 name, display only
          npub: string | null;              // public identity, never the key
          signerKind: "box" | "desktop" | "nip46" | null;
          lastSyncAt: string | null };
  channels: { id: string; name: string; kind?: "stream" | "forum";
              visibility?: "open" | "private"; topic?: string; unread?: number }[];
  threads:  { channelId: string; rootEventId: string; excerpt: string;
              replyCount?: number; updatedAt?: string }[];
  dms:      { id: string; participants: string[]; updatedAt?: string }[];
  canvases: { channelId: string; updatedAt?: string }[];   // body fetched on demand
  workflows:{ id: string; name: string; channelId?: string;
              pendingApprovals?: number }[];
  agents:   { npub?: string; name: string; access?: string;
              draftState?: "ready-for-review" | "saved" }[];
  pending:  { id: string; group: string; verb: string; requestedAt: string;
              state: "queued" | "sent" | "done" | "failed"; note?: string }[];
}
```
No field here is a secret, and the normalizer drops anything key-shaped (`nsec1…`, 64-hex private material) rather than storing it — a hostile relay payload does not get to plant a credential in the owner's document.

4.3 Owner-only actions
Allowlisted, mapped to `buzz-cli` verbs (`crates/buzz-cli/README.md` is the source of truth):

| Mini-app action | `buzz` | Notes |
|---|---|---|
| `refresh` | `channels list`, `dms list`, `workflows list`, `users get` | Read fan-out; also the liveness check. |
| `channel-create`, `channel-join`, `channel-topic`, `channel-purpose`, `channel-update` | `channels create/join/topic/purpose/update` | Community-local, relay-enforced membership. |
| `message-send`, `message-reply` | `messages send [--reply-to] [--broadcast]` | Body via **stdin** (`--content -`), never argv. Confirm step in the view: a sent message is public and one-way. |
| `thread-view`, `message-search` | `messages thread`, `messages search` | Read; escape everything (C9). |
| `dm-open` | `dms open --pubkey <hex>` | Up to 9 participants per Buzz's model. |
| `canvas-view`, `canvas-set` | `canvas get/set` | Content via stdin; last-write-wins with exit code 5 handling. |
| `workflow-trigger`, `workflow-approve` | `workflows trigger/approve --token` | Approvals are the whole point of the gate — always a confirm step, never batched. |
| `agent-draft-create`, `agent-draft-update` | `agents draft-create/draft-update` | Requires `BUZZ_AUTH_TAG`; result is **"ready for review"** (`saved: false`), rendered as such. Never "created". |
| `reaction-add` | `reactions add` | Trivial, reversible. |
| `presence-set`, `status-set` | `users set-presence/set-status` | Owner's own identity only. |
| `connect-begin`, `connect-cancel`, `disconnect` | control plane | Binding lifecycle (§2b). |
| `prompt` | Hermes turn | Shared prompt bar (MA10). |

Refused by construction: `messages delete`, `mem rm`, `repos protect set/remove`, and anything bulk or destructive — those stay in Buzz's own surfaces. `agents` creation exists **only** as owner-reviewed drafts; there is no path here that saves an agent.

4.4 View
Server-HTML, one screen: a link panel (status chip, community label, npub short form, signer kind, `Connect Buzz`/`Disconnect`, last sync), then collapsible `Channels`, `Threads`, `DMs`, `Agents`, `Workflows` (with pending approvals surfaced first), `Canvases`, then `pending` operations, then the prompt bar. Agent rows show `ready for review` where a draft is outstanding, with a line saying the owner must save it in Buzz Desktop. Relay unreachable = last-synced state plus an honest staleness line.

5. Milestones

**§MA-Z1 — Skeleton.** `buzz.tsx` (owner-only; `forbidden` for guests and unknown actions), `index.ts` registration, migration row, `lib/miniapps/buzz/state.ts` document + normalizer (including the key-shaped-value drop), box read/write, prompt bar, `refresh` as a no-op while unbound. Tests: owner gate, unknown action, hostile document (including a planted `nsec1…`), empty state.

**§MA-Z2 — Community binding.** Migration for `buzz_links` (`user_id uuid not null` — C7, `relay_url`, `community_label`, `npub`, `signer_kind`, `status`, `paired_at`, `last_seen_at`, `revoked_at`) and pairing codes for the desktop signer. Relay-URL validation (C5), NIP-98 challenge through the chosen signer, status chips, `disconnect`. Negative tests: loopback/private relay URL, redirecting relay, replayed challenge, another user's pairing code, revoked binding.

**§MA-Z3 — Intent lane.** `commands.ts` allowlist + arg validation + **stdin routing for every content-bearing flag**, intent signing/expiry/single-use ledger, box-signer execution path, `pending` lifecycle, exit-code mapping (`3` → re-bind prompt, `5` → re-read + single retry). Negative tests: verb outside the allowlist, replayed intent, argv-smuggled content (must be impossible by shape), oversized args, a `BUZZ_PRIVATE_KEY` value appearing anywhere (assertion test over rendered HTML, document, and logs).

**§MA-Z4 — Read surfaces.** Channels/threads/DMs/workflows/agents/canvases rendering with full escaping, unread and pending-approval counts, offline rendering.

**§MA-Z5 — Write surfaces.** Messaging (with confirm), channel management, canvas set, reactions, presence/status, workflow trigger/approve, and `agents draft-create`/`draft-update` with the review-not-created wording enforced in the view.

**§MA-Z6 — Buzz-side work (child session in `gratitude5dee/buzz`, only if needed).** Anything missing on the Buzz side belongs in `buzz-cli` (per Buzz's `AGENTS.md`: agent-facing operations go there; prefer a Nostr event kind over a new HTTP endpoint), plus Desktop pairing if the desktop-signer path ships. Validated with `just ci` (and `just test` if relay/db/auth were touched); commits signed off (`git commit -s`).

**§MA-Z7 — Hardening.** Red-team additions in `lib/security/`: prompt-injected agent attempting to bind a relay, mint an intent, exfiltrate a key handle, or approve its own workflow; a bound device requesting another user's intents; the C18 sweep extended with `nsec1`/`bunker://`/64-hex patterns across box documents, HTML, and logs.

6. Acceptance
- [ ] An owner with no Buzz binding opens `/mini/buzz`, sees `○ not connected`, and can bind a community end-to-end with **no field anywhere that accepts a private key**.
- [ ] After binding, `refresh` renders real channels from the relay, and the community label matches the relay URL's community (URL is authoritative).
- [ ] `disconnect` revokes immediately: the next intent for that binding is rejected and the view shows `○ disconnected`.
- [ ] Sending a message from the mini-app appears in Buzz as an event authored by the owner's npub, with the body passed via stdin — verified by asserting the body never appears in `argv`, logs, or the intent record.
- [ ] `agent-draft-create` reports **"ready for review"**, creates no agent, and the agent only exists after the owner saves the draft in Buzz Desktop.
- [ ] A workflow approval from here requires an explicit confirm and is never issued in bulk.
- [ ] A verb outside the allowlist (hand-crafted form) is refused server-side with no intent minted; `messages delete` is unreachable.
- [ ] Guest and non-owner sessions get 403 everywhere; a `buzz` cookie at another slug is 403 (MA2).
- [ ] Postgres holds no message body, canvas, agent prompt, or key material for the whole acceptance run (C4/C18 grep); the box document holds no key-shaped value even when the relay returns one.
- [ ] Hostile relay content (script tags, `--flag`-looking channel names, an `nsec1…` in a display name) renders escaped, is never interpolated into a command, and is dropped where it is credential-shaped (C9/C18).
- [ ] Zero cookies/requests to `air.wzrd.tech`, zero box URLs, zero tokens in URLs after load.
- [ ] `npm run typecheck && npm run lint && npm run test` clean, with each new gate's negative tests in the same PR.

7. Devin child-session plan
Buzz is **independent of the image-editor upgrade** (`image.goal.md`) and of Berd (`berd.goal.md`) — disjoint files, no shared lane, no dependency on the Toolcraft bundle. It starts immediately and runs concurrently.

| Session | Scope | Blocked by | Owns (disjoint paths) |
|---|---|---|---|
| K1 | §MA-Z1 | — | `lib/miniapps/apps/buzz.tsx`, `lib/miniapps/buzz/state.ts`, migration row, tests, one line in `apps/index.ts` |
| K2 | §MA-Z2 + §MA-Z3 | K1 | `lib/miniapps/buzz/link.ts`, `commands.ts`, `app/api/buzz/**`, its migrations |
| K3 | §MA-Z4 + §MA-Z5 | K2 | `buzz.tsx` view sections (after K1 merges) |
| K4 | §MA-Z6 (in `gratitude5dee/buzz`) | K2's intent shape frozen | Buzz repo only — different repo, zero conflict risk |
| K5 | §MA-Z7 | K3, K4 | `lib/security/**` |
| J* | Berd (`berd.goal.md`) | — | Berd's own files |
| F* | Image (`image.goal.md`) | — | Image/creative/loader files |

Rules: K never touches `app/mini/[app]/route.ts` (image §MA-I3 owns loader dispatch this cycle) — escalate instead. Berd and Buzz share only `apps/index.ts` (one line each) and the migration counter: take the next free number, rebase, never renumber. J2/K2 should agree on the envelope/intent primitive rather than shipping two divergent ones; if the shapes drift, factor a shared `lib/miniapps/link/` in a follow-up session, not mid-flight.

8. Escalate to a human, do not decide
- Any C- or MA-constraint appears to block a task. The constraint is right.
- Any design that needs a private key in the browser, in `argv`, in Postgres, in a document, or minted by the control plane (C18/C2) — including "just for local dev".
- Any inbound reach into the user's machine or relay bypassing the community boundary.
- A new relay HTTP endpoint: Buzz's rule is Nostr-event-first, and that is Buzz's architecture decision, not ours.
- Anything that would save a Buzz agent without the owner's Desktop review, or approve a workflow without an explicit human confirm.
- A user whose only credential is a raw `nsec` and who wants to paste it here. The answer is the box vault, and if that is not acceptable, escalate — do not add the field.
