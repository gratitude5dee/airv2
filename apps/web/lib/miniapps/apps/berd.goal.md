berd.goal.md — build spec for the Berd mini-app (self-hosted Berd control surface in Air)

Read `goal.md` and `ARCHITECTURE.md` in full before starting. Where this file and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins and this file is the bug.

Goal: a full-functionality, self-hosted mini-app version of **Berd** — `mini.wzrd.tech/berd` — from which the owner manages *their own* Berd agents: personas/agents, projects, skills, extensions, providers, sessions, and automations. Berd is a **local desktop app** (Tauri 2 + React 19 talking to a `goosed`/Goose backend over ACP), so the hard part of this spec is not the UI: it is how a mini-app on a cloud origin reaches an app running on the user's machine without inventing a new trust boundary. Everything else is the existing mini-app rails.

Non-goal, stated first so nobody drifts: this is **not** a re-implementation of Berd in the browser and not a hosted Berd. It is a control surface over the user's own instance, and every mutation is one Berd already performs and shows in its own UI.

0. What already exists — audit before you write code
Do not rebuild any of this. Extend it.

| Subsystem | Where | State |
|---|---|---|
| Mini-app module contract | `apps/web/lib/miniapps/apps/types.ts` | Live. `MiniAppModule { render(ctx), action?(ctx, form), guestActions?, publicAccess? }`; `MiniAppContext { request, supabase, app, session, basePath }`. The module receives an **already verified** session — it never parses a token. |
| Module registry | `apps/web/lib/miniapps/apps/index.ts` | Live. `FIRST_PARTY_MODULES` maps slug → module; a row without a module (or a module without a published row) does not load. One line added here per new app. |
| Registry table + parser | `supabase/migrations/0007_miniapps.sql` (+0034 era columns), `apps/web/lib/miniapps/registry.ts` | Live. `RegistryApp` already carries `kind`, `visibility`, `access`, `password_hash`, `x402_*`, **`plugin_signin_enabled`**, `status`, `bundle_version`. New apps are a row, not a schema change. |
| Loader + gate chain | `apps/web/app/mini/[app]/route.ts` | Live. slug → registry row (404 unless `published`) → visibility → password → x402 → session, then dispatch. Path is a routing hint; claims authorize (MA2). |
| Box-side app state | `apps/web/lib/miniapps/store.ts` `readAppState`/`writeAppState` → `.hermes/miniapps/<app>/<resource>.json` | Live. The C4 pattern: the agent's tools and the mini-app view read and write the same file. |
| Connect pattern (the auth model to copy) | `apps/web/lib/miniapps/apps/connect.tsx` + `lib/connectors/manage.ts` | Live. Owner-only server-HTML: toolkit list, **status chips** (`● connected` / `◌ pending` / `○ disconnected`), `beginConnect(supabase, userId, toolkit, callback)` → 303 to a **hosted** link with `callback = externalOrigin(request) + basePath`, `syncConnections` on render when anything is pending, disconnect revokes, unknown action → `forbidden`. The browser sees names and statuses; never a credential. |
| Prompt bar | `apps/web/lib/miniapps/promptBar.ts` | Live. Owner-session-only Hermes turn with `{app, resource}` metadata; the view re-reads state afterwards (MA10). |
| Card surface | `lib/miniapps/cards.ts`, `cardSends.ts` (`CardKind`), `card_sends` cooldown | Live. Adding an app the agent may send as an iMessage card = extend `CardKind` + the two check constraints (see `0057_feedback.sql` for the exact shape). |
| Decisions / Needs-you | existing `decisions` lane | Live. Any side effect that should not happen unilaterally becomes a decision, not a silent write. |
| **Berd** — product surface | `gratitude5dee/berd` `PRODUCT.md`, `README.md` | Reference. Tauri 2 + React 19 desktop; talks to the upstream Goose backend over the **ACP WebSocket** served by a `goose serve` sidecar (`goose-backend.lock.json` pins it). Product surfaces: chat/sessions, projects, skills, extensions, providers, automations, onboarding, workspace context. |
| **Berd** — agent control surface | `gratitude5dee/berd` `src-tauri/README.md`, `docs/berdctl-architecture.md`, `src/features/berdctl/` | Reference. `berdctl` CLI (`src-tauri/crates/berdctl`, shipped as an `externalBin` sidecar) → **loopback HTTP broker** (`src-tauri/plugins/berdctl`, discovered via the `BERDCTL_LOCK` file, `GET /v1/ping` for `protocolVersion`/generation, `POST /v1/call {"command","args"}`) → **renderer registry** (`src/features/berdctl/commands/`) which owns zod validation, guards, and execution. Command groups today: `sessions`, `folders`, `projects`, `agents` (`create`, `list`), `skills` (`create`, `list`, `get`), `info` (`list_harnesses`, `list_models`, `get_context`), `feedback` (build-gated). |
| **Berd** — safety model | `docs/berdctl-architecture.md` §Safety model | Reference, and binding on us: v1 has **no auth tokens and no confirmation dialogs** on the broker. That is only acceptable because every command is UI-visible and either reversible or an explicit user-requested product action. No invisible mutations; delete/bulk/silent verbs require reopening Berd's auth design. **This mini-app must not become the exception that makes the loopback broker dangerous.** |
| Berd validation | `just check`, `just test`, `just tauri-check`, `pnpm generate:berdctl-contract`, `cargo test -p berdctl` | Reference. Any change on the Berd side of this integration runs these; contract JSONs are generated, never hand-edited. |

1. Hard constraints

| # | Constraint as it applies here |
|---|---|
| MA1 | `mini.wzrd.tech/berd` shares **no** cookie, storage, or session with `air.wzrd.tech`. A "sign in to Berd" here is its own session, minted by token handoff. Never a shared cookie domain, never `document.domain`. |
| MA2 | `berd` in the path is routing only; the minted claims authorize. `role !== "owner"` ⇒ 403 before any Berd call. |
| MA4 | `access = 'single'`. There is no guest surface: a guest with a `berd` URL sees `forbidden`. `guestActions` stays empty/absent. |
| MA5 | Every gate — owner check, pairing validity, per-command allowlist — executes server-side in the module. A hidden button is not a gate. |
| MA10 | The agent does not learn "the Berd mini-app" exists. It reads/writes `.hermes/miniapps/berd/<resource>.json` with its normal file tools and can run `berdctl` where it exists; the view renders that state. |
| C3/C16 | No box `_token`, no `API_SERVER_KEY`, no box URL ever reaches this view. All box I/O goes through the control plane. |
| C4 | Berd agents, projects, skills, provider *names*, and cached listings live in the box document. Postgres holds only routing/pairing metadata: `(user_id, status, paired_at, last_seen_at, protocol_version)`. No agent prompt, session transcript, project path, or skill body in a table. |
| C5 | Any outbound host this integration talks to is on an explicit allowlist. No "just fetch whatever the desktop reports". |
| C18 | Provider API keys are Berd's business and stay on the user's machine. This surface shows provider **name + configured/not-configured**, never a key, never a masked-but-recoverable value, and never accepts a key in a form field. Adding a provider credential is done in Berd itself; the mini-app deep-links to it. |
| Berd's own safety model | Commands invoked from here are limited to the UI-visible, reversible/explicit set (§4.3). Destructive, bulk, or invisible operations are refused by our allowlist even if `berdctl` grows them. |

2. Auth: draw from existing auth, or re-sign-in
Two paths, in this order — the same shape as `connect.tsx` (`beginConnect` → hosted link → status chips), with the "hosted link" being the user's own Berd instance instead of a provider:

**(a) Draw from existing auth.** The Air owner session that opened the mini-app is already proof of identity: the loader verified a minted, scoped, single-use link and the module sees `session.role === "owner"` and `session.userId`. If a live pairing exists for that user (`status='paired'`, not expired, `last_seen_at` fresh), the view renders connected and acts immediately. No second login, no re-auth prompt, no credential of Berd's ever touching the browser.

**(b) Re-sign-in (pair / re-pair).** No pairing, an expired one, or a `protocolVersion` mismatch renders a `○ not connected` chip and one primary action, `Connect Berd`, which starts a **device-code pairing** (the shape `goal.md` §4.4 already uses for plugin sessions):
1. `POST` action `pair-begin` (owner-only) creates a pairing row and returns a short, human-typable code + expiry (≤10 min, single-use), displayed in the mini-app.
2. The user enters that code in Berd (`Settings → Connections → Air`) — or clicks the deep link `berd://pair?code=…` which fills it. Berd is the side that *initiates* the connection, so the user's explicit act in their own app is the consent step.
3. Berd exchanges the code for a **long-lived, revocable, per-device token** stored in the desktop's own secure storage, and reports its `protocolVersion` + generation. The mini-app never sees that token: it is a Berd-side credential, held on the user's machine.
4. The mini-app renders `● connected · <device label> · <protocol vN>` and a `Disconnect` action that revokes the row (and is honored on Berd's next contact).

`plugin_signin_enabled = true` on the registry row is what additionally lets a headless WZRD.Tech plugin session (Codex/Claude Code) open this app — the same gate as the rest of the platform (`goal.md` §MA2.4), not a second auth system. Pairing is per (user, device); several Berd installs may be paired and the view names them.

3. Reaching a desktop app from a cloud origin
Stated plainly: **nothing in Air can dial a user's laptop.** The loopback broker binds to localhost, is discovered through a local `BERDCTL_LOCK` file, and rejects foreign headers; it is not, and must not become, an internet-reachable endpoint. So the transport is always **outbound from Berd**. Three mechanisms, in priority order:

**3.1 Paired outbound channel (primary).** Berd, once paired, holds an authenticated outbound connection to the control plane (long-poll or WebSocket at `api.…/berd/link`, one allowlisted host — C5) and pulls *command envelopes*:
```
envelope := { id, user_id, issued_at, expires_at (≤120s), single_use: true,
              group: "agents"|"projects"|"skills"|"sessions"|"info",
              action: "<allowlisted verb>", args: <validated JSON>, sig }
```
Berd verifies the signature and expiry, then hands the envelope to **exactly the path an agent shell would use**: the berdctl broker → renderer registry, where zod validation, guards, and Berd's own visibility rules already live. Berd never trusts our `args` shape; the renderer registry re-validates. Results come back on the same channel and are written into the box document, which is what the view renders. Nothing new gets to bypass the registry, which is the entire point of Berd's invariant "no command-specific knowledge below the renderer registry".

**3.2 Signed handoff / deep link (fallback, and the only path with no pairing).** For a one-shot action the mini-app can render a `berd://…` deep link carrying a signed, short-lived, single-use envelope; the desktop verifies and, per Berd's safety model, **opens the corresponding UI with the operation staged** rather than performing it silently. Suitable for "open this project", "create this agent (form pre-filled)", "add a provider" — the mutation is the user's click inside Berd. Use this whenever an operation is not on the reversible/visible allowlist.

**3.3 Box-hosted Berd (first-class, alongside the desktop).** Each user can run their own Berd inside their own Box (headless `goosed` + `berdctl`), and both the box Hermes agent and the owner connect to it: the control plane already has an authenticated path to the Box and can invoke `berdctl` there through the existing box command lane, and the Hermes agent reaches it as a normal local tool. The §MA-B2 pairing exchange is shared with the desktop — the Box-hosted instance completes it outbound the same way a desktop does — after which envelope validation and the allowlist are identical. Treat this as a variant of 3.1's server side, not a second product.

Cookies are never the mechanism, anywhere in 3.1–3.3: MA1 forbids sharing a session with `air.wzrd.tech`, and the mini origin's cookie is 15-minute, path-scoped, and useless to a desktop app by construction.

4. The mini-app
4.1 Module contract
- New module `apps/web/lib/miniapps/apps/berd.tsx` exporting `export const berd: MiniAppModule`, server-rendered HTML through `renderShell`/`shellHtml` exactly like `connect.tsx`.
- Registered in `apps/web/lib/miniapps/apps/index.ts` (import + one entry in `FIRST_PARTY_MODULES`).
- Owner-only: `render` and `action` both return `forbidden("this view is owner-only")` when `ctx.session.role !== "owner"`; unknown/invalid actions return `forbidden`, never a redirect that pretends success.
- Registry row via a new `supabase/migrations/` entry (next free number): `slug='berd'`, `route='/mini/berd'`, `kind='render'`, `visibility='private'`, `access='single'`, `status='published'`, `plugin_signin_enabled=true`, `scopes='{berd:manage}'`, plus `CardKind`/`card_sends`/`miniapp_card_sessions` extension if the agent may send a Berd card.
- Helper lane `apps/web/lib/miniapps/berd/` (`state.ts` document types + normalizer, `link.ts` pairing + envelope issuing, `commands.ts` the allowlist). No `fetch` to a Berd host from the module (`goal.md` §7: no direct calls from route/renderer files).

4.2 Box-side state — `.hermes/miniapps/berd/<resource>.json`
The document is a **cache plus intent**, never the authority: Berd's own storage is authoritative for agents, projects, and skills; we mirror what the last sync returned so the view renders with the desktop offline (and so the agent can read it with plain file tools).
```ts
interface BerdDoc {
  schemaVersion: 1;
  title: string;
  link: { status: "unpaired" | "pending" | "paired" | "revoked";
          deviceLabel: string | null; protocolVersion: number | null;
          lastSyncAt: string | null };
  agents:   { id: string; name: string; description?: string; harness?: string; model?: string }[];
  projects: { id: string; name: string; startupMode?: string; archived?: boolean }[];
  skills:   { id: string; name: string; summary?: string }[];
  providers:{ id: string; name: string; configured: boolean }[];   // never a key (C18)
  sessions: { id: string; title: string; projectId?: string | null; updatedAt?: string }[];
  automations: { id: string; name: string; enabled: boolean }[];
  pending: { id: string; group: string; action: string; requestedAt: string;
             state: "queued" | "sent" | "done" | "failed"; note?: string }[];
}
```
Nothing in this document is a secret. If a Berd payload ever contains one, it is dropped at the normalizer — the document is readable by every surface the owner opens.

4.3 Owner-only actions and the command allowlist
Form actions map 1:1 to allowlisted berdctl group/verb pairs (`src/features/berdctl/commands/registry.ts` is the source of truth for what exists):

| Mini-app action | berdctl | Notes |
|---|---|---|
| `refresh` | `agents list`, `projects list`, `skills list`, `sessions list`, `info harnesses/models/context` | Read-only fan-out; also the pairing heartbeat. |
| `agent-create` | `agents create` | Visible product action; result "ready in Berd". |
| `agent-edit` | *not in berdctl today* | §3.2 deep link with the form staged — do not invent a hidden update verb. |
| `project-create`, `project-archive`, `project-startup-mode` | `projects create` / `archive` / `set_startup_mode` | Archive is reversible in Berd's UI. |
| `skill-create`, `skill-view` | `skills create` / `get` | Body rendered read-only. |
| `session-open`, `session-create`, `session-send`, `session-rename`, `session-move` | `sessions open` / `create` / `send` / `rename` / `move` | Explicit, visible, user-requested. `send` is one-way by nature and therefore requires the confirm step in the view. |
| `provider-configure` | — | §3.2 deep link into Berd's provider settings. Never a key field here (C18). |
| `automation-toggle` | — until an ACP/berdctl verb exists | Deep link. |
| `pair-begin`, `pair-cancel`, `disconnect` | control plane only | Pairing lifecycle. |
| `prompt` | Hermes turn | The shared prompt bar (MA10): "ask your agent" instead of clicking. |

Refused by construction: delete, bulk, and any verb Berd classifies as silent/invisible/destructive. If a future berdctl adds one, our allowlist still excludes it until this spec changes.

4.4 View
Server-HTML, one screen, `connect.tsx` visual language: a link panel (status chip, device label, protocol version, `Connect Berd` / `Disconnect`, last sync), then collapsible sections `Agents`, `Projects`, `Skills`, `Sessions`, `Providers`, `Automations`, each a list from the document with its allowlisted actions, then `pending` operations with their state, then the prompt bar. Offline desktop = the last-synced lists plus an honest "Berd hasn't checked in since …" line, never a spinner that lies.

5. Milestones

**§MA-B1 — Skeleton.** `berd.tsx` (owner-only, forbidden on guests/unknown actions), `index.ts` registration, migration row, `lib/miniapps/berd/state.ts` with the document + normalizer, box read/write through `readAppState`/`writeAppState`, prompt bar, `refresh` as a no-op-when-unpaired. Renders correctly with no Berd anywhere. Tests: owner gate, unknown action, hostile document, empty state.

**§MA-B2 — Pairing.** Migration for `berd_links` (`user_id`, `device_label`, `token_hash`, `protocol_version`, `status`, `paired_at`, `last_seen_at`, `revoked_at`; C7: `user_id uuid not null`) + `berd_pairing_codes` (single-use, ≤10 min, hashed). Actions `pair-begin`/`pair-cancel`/`disconnect`; status chips; the exchange endpoint Berd calls. Negative tests: replayed code, expired code, another user's code, revoked token, unpaired action attempts.

**§MA-B3 — Envelope lane.** `lib/miniapps/berd/commands.ts` allowlist + envelope signing/expiry/single-use ledger, the outbound channel endpoint (§3.1) with per-user rate limits, `pending` lifecycle in the document, results merged into the cached lists. Negative tests: an envelope for a non-allowlisted verb, a replayed envelope, an envelope fetched by the wrong device, an oversized/misshaped `args`.

**§MA-B4 — Read surfaces.** `refresh` fan-out and rendering of agents/projects/skills/sessions/providers/automations, offline rendering, provider `configured` booleans only.

**§MA-B5 — Write surfaces.** The allowlisted mutations of §4.3 with their confirm steps, plus the §3.2 deep-link path for everything not allowlisted (agent edit, provider configure, automation toggle).

**§MA-B6 — Berd-side work (child session in `gratitude5dee/berd`).** Settings→Connections pairing UI, the outbound link client, envelope verification, and the dispatch into the existing broker→registry path. Validated with `just check`, `just test`, `just tauri-check`, `pnpm vitest run src/features/berdctl`, `cargo test -p berdctl`. New berdctl commands (if any) go through `.agents/skills/berdctl-new-command/SKILL.md`; contract JSONs are generated.

**§MA-B7 — Hardening.** Red-team additions in `lib/security/`: prompt-injected agent trying to pair a device, mint an envelope, or escalate a deep link; a paired device asking for another user's envelopes; C18 sweep confirming zero provider-key material in documents, logs, or HTML.

6. Acceptance
- [ ] An owner with no Berd installed opens `/mini/berd`, sees `○ not connected` and a working `Connect Berd` code flow; nothing 500s and no fake data appears.
- [ ] Pairing completes from Berd; the mini-app shows `● connected`, device label, protocol version, and a real `agents list` result within one refresh.
- [ ] `Disconnect` revokes immediately: the next envelope fetch by that device is rejected and the view shows `○ disconnected`.
- [ ] Creating an agent from the mini-app produces an agent that is visible in Berd's own UI (Berd's safety model holds — nothing invisible happened).
- [ ] An action not on the allowlist is refused server-side even when the form is hand-crafted (403, no envelope minted).
- [ ] A guest session and a non-owner session get 403 on every route and action; a `berd` cookie presented at another slug is 403 (MA2).
- [ ] Postgres contains no agent prompt, session transcript, project path, or skill body for the whole run of the acceptance suite (C4 grep).
- [ ] No provider key appears in the document, the HTML, or any log; no form on this surface accepts one (C18).
- [ ] With Berd closed, the view renders last-synced state plus an honest staleness line; queued operations show `queued` and run on reconnect (or expire honestly).
- [ ] Zero cookies/requests to `air.wzrd.tech` from this origin, zero box URLs, zero tokens in URLs after load.
- [ ] `npm run typecheck && npm run lint && npm run test` clean, with each new gate's negative tests in the same PR.

7. Devin child-session plan
Berd is **independent of the image-editor upgrade** (`image.goal.md`) and of Buzz (`buzz.goal.md`): disjoint files, no shared lane, no dependency on the Toolcraft bundle work. It can start immediately and run fully concurrently.

| Session | Scope | Blocked by | Owns (disjoint paths) |
|---|---|---|---|
| J1 | §MA-B1 | — | `lib/miniapps/apps/berd.tsx`, `lib/miniapps/berd/state.ts`, migration row, tests, one line in `apps/index.ts` |
| J2 | §MA-B2 + §MA-B3 | J1 | `lib/miniapps/berd/link.ts`, `commands.ts`, `app/api/berd/**`, its migrations |
| J3 | §MA-B4 + §MA-B5 | J2 | `berd.tsx` view sections (after J1 merges) |
| J4 | §MA-B6 (in `gratitude5dee/berd`) | J2's envelope shape frozen | Berd repo only — different repo, zero conflict risk |
| J5 | §MA-B7 | J3, J4 | `lib/security/**` |
| K* | Buzz (`buzz.goal.md`) | — | Buzz's own files |
| F* | Image (`image.goal.md`) | — | Image/creative/loader files |

Rules: J touches `app/mini/[app]/route.ts` **never** — if a loader change seems necessary, stop and escalate to the session that owns it (image §MA-I3 owns loader dispatch this cycle). Take the next free migration number and rebase rather than renumbering another session's file. J4 lands in the Berd repo behind a feature flag so airv2 can merge first.

8. Escalate to a human, do not decide
- Any C- or MA-constraint appears to block a task. The constraint is right.
- Any design that requires an inbound connection to the user's machine, exposing the loopback broker beyond localhost, or weakening its header rejection.
- Any request to accept a provider API key, a Goose credential, or any secret in this surface (C18/C2).
- Any command that is destructive, bulk, or invisible in Berd's UI — that reopens **Berd's** auth/confirmation design (`docs/berdctl-architecture.md` §Safety model), which is not ours to reopen in a PR.
- Sharing any session/cookie with `air.wzrd.tech`, or holding a Berd device token anywhere a browser can read it.
- Storing Berd content (transcripts, prompts, project contents) in Postgres to "make the list faster".
