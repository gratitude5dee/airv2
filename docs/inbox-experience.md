# Inbox mini-app — full mail experience

Implementation spec for `gratitude5dee/airv2` (`apps/web`) with a small companion
change in `gratitude5dee/wzrdmail` (`services/api`). Read `ARCHITECTURE.md`
invariants before writing code — the mail surface is where I2, I5, and C10 all
meet. Commit this file as `docs/inbox-experience.md` in the airv2 PR.

## 0. Current state (verified 2026-10-05)

`apps/web/lib/miniapps/apps/inbox.tsx` today: flat thread list (100/page,
`page_token` continue), thread view (escaped text only), attachments served
through a same-origin route, compose/reply → provider draft + `email_draft`
Needs-you decision, pending-review cards above the list, `senders`-table
blocked badge, `promptBar` → MAIN_SESSION run. Owner-only
(`ctx.session.role !== "owner" → 403`), lite mode for card sessions.

Mail provider layer: `lib/mail/client.ts` routes every call by
`MAIL_PROVIDER` (default `wzrdmail`) into `lib/wzrdmail/client.ts` or
`lib/agentmail/client.ts`. The shared surface is typed as
`Omit<typeof agentmail, "AgentMailApiError">` — **any function added to the
router must be exported from both provider modules** or the typecheck fails.

wzrdmail API (`services/api`, Hono + D1) already supports everything this spec
needs:

| Capability | Endpoint | Notes |
|---|---|---|
| List threads | `GET /v0/inboxes/{id}/threads?folder=&limit=&page_token=` | `folder`: `all` (default) or `trash` |
| Search threads | `GET /v0/inboxes/{id}/threads/search?query=` | subject/preview LIKE |
| Thread detail | `GET /v0/inboxes/{id}/threads/{tid}` | messages incl. trashed when thread trashed |
| Patch thread labels | `PATCH /v0/inboxes/{id}/threads/{tid}` | `{add_labels, remove_labels, labels}` — `admin` perm |
| Trash/restore thread | `DELETE …/threads/{tid}` · `POST …/threads/{tid}/restore` | soft-delete, 30-day purge cron |
| List messages | `GET /v0/inboxes/{id}/messages?labels=&folder=&before=&after=` | `folder` also `scheduled`; `labels` csv AND |
| Search messages | `GET /v0/inboxes/{id}/messages/search?query=` | |
| Patch message | `PATCH /v0/inboxes/{id}/messages/{mid}` | labels + `read` bool (`read` ⇄ `unread` label) |
| Trash/restore message | `DELETE` · `POST …/restore` | |
| Batch | `POST …/messages/batch-get` · `PATCH …/messages/batch-update` | ≤100 ids |
| Drafts | `GET/POST …/drafts`, `GET/PATCH/DELETE …/drafts/{did}`, `POST …/drafts/{did}/send` | CreateDraftInput: `to,cc,bcc,subject,text,html,reply_to,in_reply_to,labels,client_id` |
| Block list | `GET/POST/DELETE /v0/inboxes/{id}/lists/receive/block` | ingress rejects blocked senders (550, `message.rejected` event) |
| Raw MIME | `GET …/messages/{mid}/raw` | |

System labels already written by wzrdmail: `unread`, `received` (inbound),
`sent` (outbound). There is **no native spam concept** — we define one
(`spam` label) below.

## 1. Scope

Build the inbox mini-app into a full mail client: folder navigation
(Inbox · Unread · Drafts · Sent · Spam · Trash), search, per-message and
per-thread actions (read/unread, spam/not-spam, trash/restore, block sender),
a real compose surface (manual + agentic), draft management (view, edit,
delete, approve-and-send), and edge-side spam classification via **Jev on the
Vercel AI Gateway** (`lib/jev`).

Non-goals: HTML mail rendering (mail stays escaped-text — the reduced-trust
reader is deliberate, see current file header); remote images; client-side
JS state/storage (C17); guest access; real-time push (server-rendered GET/POST
only).

## 2. Provider layer — `lib/mail/client.ts`

Extend the shared surface. Every new function exists on **both** providers;
where AgentMail lacks the concept, export a stub that throws
`new AgentMailApiError(501, "unsupported on agentmail")` (match the class's
constructor shape). The mini-app treats 501 as "hide/disable that control".

wzrdmail implementations (`lib/wzrdmail/client.ts`), same
`wzrdmailFetch`/timeout/error conventions as the existing code:

```ts
listThreadsFiltered(inboxId, { limit, pageToken?, folder?: "all"|"trash", labels?: string[], query?: string })
  // → GET /threads?folder=&labels=&query=  (labels param lands in wzrdmail PR, see §7;
  //   until deployed, pass folder+query and filter `spam` client-side from thread.labels)
getThreadLabels / patchThread(inboxId, threadId, {add_labels?, remove_labels?})
  // → PATCH /threads/{tid} — admin permission, control-plane key only
trashThread(inboxId, threadId)          // DELETE /threads/{tid}
restoreThread(inboxId, threadId)        // POST /threads/{tid}/restore
listMessages(inboxId, { labels?: string[], folder?: "all"|"trash"|"scheduled", limit, pageToken? })
  // → GET /messages?labels=&folder=  (wzrdmail uses its own page-token shape; map it)
searchMessages(inboxId, query, {limit, pageToken?})
patchMessage(inboxId, messageId, {add_labels?, remove_labels?, read?})
trashMessage(inboxId, messageId)        // DELETE /messages/{mid}
restoreMessage(inboxId, messageId)      // POST /messages/{mid}/restore
updateDraft(inboxId, draftId, {to?, cc?, bcc?, subject?, text?})  // PATCH /drafts/{did}
deleteDraft(inboxId, draftId)           // DELETE /drafts/{did}
```

Keep the returned types on the existing `MailThread`/`MailMessage`/`MailDraft`
aliases (the wzrdmail wire shape already serializes `labels`,
`participants`, `last_message_at`, `deleted_at`, `direction`, `state` — extend
the `AgentMailThread`/`AgentMailMessage` interfaces in
`lib/agentmail/client.ts` with optional `labels?: string[]` and
`deleted_at?: string | null` so both providers typecheck).

**C10 is unchanged:** never call `messages/send`, `/reply`, `/reply-all`,
`/forward`, or `drafts/{id}/send` from any code path except the existing
`sendHeldDraft` approval route. Forward and reply-all in the UI create
*drafts*, which re-enter the review queue.

## 3. Mini-app information architecture

Slug stays `inbox`; one module file or a small `apps/inbox/` family
(`inbox.tsx` + `inbox-views.ts` + `inbox-actions.ts`) — follow neighboring
apps' file conventions. All state in query params (`?folder=`, `?thread=`,
`?draft=`, `?q=`, `?page_token=`, `?notice=`); forms POST and 303 back.

Folder → provider mapping:

| Folder | Query |
|---|---|
| `inbox` (default) | threads, `folder=all`, excluding threads carrying `spam` (server-side `labels` param when available, else client-side filter) |
| `unread` | messages `labels=unread` grouped to threads — or threads filtered client-side by `labels` contains `unread` |
| `drafts` | `listDrafts` — separate object list, not threads |
| `sent` | messages `labels=sent` (flat message list) |
| `spam` | threads with `spam` label (labels param / client filter) |
| `trash` | threads `folder=trash` |

Folder nav = a horizontal chip row under the headline (`.chip` / `.chip.on`
from the shell; add counts when the wzrdmail counts endpoint lands — §7).

### 3.1 Thread list row

Unread dot when `labels` contains `unread`; sender avatar-initial (existing
`.avatar` w/ `tintHue`); subject (bold if unread), one-line preview,
`· N messages`, relative date (`Today 10:48 AM` / `Oct 3`), `blocked` and
`spam`/`trash` badges where relevant. Entire row is one `<a>` to `?thread=`.

### 3.2 Thread view

Header: subject, back link (`←` to the folder that linked here — pass
`?from=`), toolbar of small `form.inline` POST buttons:

- Mark unread / mark read (patch `read` on each message — or thread-level
  `add_labels`/`remove_labels` of `unread` if patching the thread suffices;
  verify against wzrdmail's `applyLabelPatch`, which puts `unread` on the
  thread row only — prefer per-message `read` PATCH, thread label optional)
- Move to spam / Not spam (`add_labels:["spam"]` / `remove_labels:["spam"]`
  on thread + its messages via `batch-update`)
- Block sender / Unblock sender (`senders` table + `addInboxBlockEntry` /
  `removeInboxBlockEntry` — existing code)
- Trash / Restore / empty-trash note ("trash purges after 30 days")
- Reply · Reply all · Forward — each opens a compose form anchored to the
  thread, producing a **draft** (`createDraft` with `in_reply_to`, computed
  `to`/`cc` for reply-all, `Fwd:` subject + quoted/plain body for forward)

Message rendering unchanged: escaped text, same-origin attachments.
Opening a thread marks it read (`patchMessage read:true` on its unread
messages — best-effort, don't fail the render).

### 3.3 Drafts

Draft row → `?draft=` view: editable form (PATCH), Delete, and **Approve &
send** which files-or-reuses the `email_draft` decision then resolves it
through `resolveEmailDraftDecision` (single send path). Drafts that already
have a pending decision show the review card treatment (existing
`renderReviews` style).

### 3.4 Compose

`?compose=1` (and "Compose" affordance in the folder bar): To / Cc / Subject /
Body + three buttons:

- **Save draft** → `createDraft` + `queueEmailDraftReview` (current behavior)
- **Send now** → `createDraft` → `queueEmailDraftReview` →
  `resolveEmailDraftDecision(approve=true)` in the same action. Owner typed
  it; the decision row is the audit trail and the send still leaves through
  the one control-plane path.
- **Draft with Air** → §4.

## 4. Agentic compose

Two entry points: the compose form's "Draft with Air" (brief → agent writes)
and a per-thread "Ask Air to reply" button. Both reuse `runPrompt`-style
dispatch but with a structured instruction so the box agent's
`email-draft-review` skill does the work:

```ts
input = [
  `Draft an email ${threadCtx ? "replying to thread " + threadId : ""}`,
  `to ${to || "(choose from context)"} — subject: ${subject || "(derive)"}.`,
  `Owner's brief: ${brief}`,
  "Create the draft via the mail MCP create_draft tool, then POST it to",
  "/api/email/drafts/review per your email-draft-review skill.",
].join("\n")
```

`createRun(MAIN_SESSION)` exactly like `runPrompt`, with
`metadata.app="inbox"`, `metadata.surface="miniapp"`, and the thread/brief in
`metadata`. Async by nature → 303 back with notice "Air is drafting — it'll
appear under Drafts / Needs-you." No synchronous send ever. The existing
`promptBar` stays at the bottom for freeform asks.

## 5. Spam classification at the edge — Jev via Vercel AI Gateway

New module `lib/jev/mail.ts` beside `lib/jev/router.ts`, same transport
(`pickBackend` → TypeSafe `/v1/systemone` or AI Gateway
`/evaluation-model`, `ai-model-id: typesafe-ai/jev`, same headers/version
constants — extract the shared request builder). **Fail-open, same contract:**
any error/timeout/missing key → `null`, mail flow unchanged.

Hook it into `processInboundEmail` (`lib/email/inbound.ts`) for **tier-2
(unknown) senders only**, after the `tier2_contact` decision criteria but
cheap enough to run before filing:

Questions (one batched call, `state = {surface: "air-mail", from, subject,
preview}` — never the full body):

```ts
{
  spam:        { type: "noul", instructions: "This message is spam, phishing, or bulk unsolicited marketing." },
  transactional:{ type: "noul", instructions: "This is a legitimate automated notice — receipt, order update, calendar invite, security alert." },
  needs_reply: { type: "noul", instructions: "A real person wrote to the owner and expects a response." },
}
```

Policy (constants in the module, tune here only):

- `spam ≥ 0.8` → `patchMessage`/`patchThread` `add_labels:["spam"]`
  (control-plane admin key), skip the `tier2_contact` decision — it lands in
  the Spam folder silently. Log a `spam_label` event for learning-plane
  receipts (metadata only — from, subject-hash or subject snippet, score;
  **no body**, I2/C4).
- `spam ≥ 0.8 && transactional ≥ 0.6` → don't label (receipts aren't spam);
  file the normal decision.
- otherwise unchanged behavior.

The mini-app's Spam view shows a `Flagged by organization rules` banner on
spam-labeled threads (mirrors the reference screenshot) with **Not spam** and
**Block sender** actions — Not spam removes the label and records the sender
as trusted (`senders` platform=email, no `blocked_at`).

## 6. Design

Stay inside `renderShell`/`shell.ts` tokens — no new colors, no new fonts.
Extend `SHELL_CSS` (or a local `<style>` block in the module if it stays
app-scoped) with a small mail grammar:

- `.mailbar` — chip-row folder nav, horizontally scrollable
- `.mailrow` — the list row (re-skin of `.item`: avatar + 2-line text + meta)
- `.unread-dot` — 8px accent dot
- `.msgcard` — message card refinements: sender header row, meta line, body
  `white-space:pre-wrap`
- `.toolbar` — compact row of `button.ghost` action pills
- `.emptybox` — centered muted empty states ("Spam is empty. Nice.")

Swipe contract: thread view keeps `swipe.prev` → back to folder; folder views
can add `swipe.prev/next` to step between folders (optional polish). Lite
(`via === "card"`) renders inbox + thread + approve/discard only — no folder
nav, no compose (webview budget).

Everything stays server HTML: forms POST, 303 redirects, `?notice=` for
feedback. Keyboard/screen-reader: rows are real `<a>`, buttons real
`<button>`, labels on inputs.

## 7. wzrdmail service additions (separate PR in `gratitude5dee/wzrdmail`)

1. **`labels` query param on `GET /inboxes/:id/threads` and
   `GET /inboxes/:id/threads/search`** — csv AND semantics identical to the
   messages list (`EXISTS … json_each` per label). Requires `read`
   permission. Update `packages/core` schemas if a ThreadsList query schema
   exists; add route tests.
2. **`GET /inboxes/:id/counts`** (optional but wanted for the folder chips):
   `{unread, spam, drafts, trash}` — three `COUNT(*)` D1 queries; cheap and
   read-permission-gated.
3. Keep everything else as-is — trash/restore/search/labels PATCH already
   exist.

Until the wzrdmail PR deploys, the airv2 client must work with the un-patched
API: request the `labels` param anyway (unknown params are ignored by Hono —
verify) and client-side filter as fallback.

## 8. Invariants checklist

- **I2/C4** — Postgres gets ids, from, subject, label names only. Never body
  text, never thread contents in `decisions` or logs.
- **I5** — all mail content is untrusted: escaped text only; attachments only
  through the existing authenticated route; no remote URLs rendered.
- **C10** — sends only via `sendHeldDraft`/`resolveEmailDraftDecision` with
  the decision id as Idempotency-Key.
- **C17** — no cookies/storage/client state in the mini-app.
- Owner-only renders + every POST re-checks `ctx.session.role === "owner"`.
- Spam classification is metadata-in/metadata-out and fail-open.
- Idempotent actions: label/trash/restore replays are no-ops at the API;
  decision resolution is conditional-update, losing races cleanly.

## 9. Tests (vitest, existing conventions — mock `@/lib/mail/client`)

`inbox.test.ts` additions:

- folder param renders each view; spam-labeled threads excluded from inbox
- thread open marks read (`patchMessage` called with `read:true`)
- spam/not-spam actions PATCH the right labels and 303 back
- trash → `trashThread`; trash view → restore button hits `restoreThread`
- compose: save-draft vs send-now (send-now resolves the decision; assert
  `resolveEmailDraftDecision` called with approve=true)
- draft edit → `updateDraft`; delete → `deleteDraft`
- search `?q=` → `searchThreads`
- `mail.test.ts`-level: Jev classifier — mocked fetch, spam≥0.8 labels the
  message, fail-open on 500/timeout, transactional veto

wzrdmail repo: route tests for `labels` on threads list + counts endpoint
(existing vitest + `@cloudflare/vitest-pool-workers` setup).

## 10. Phasing

1. Provider surface + types (both providers; agentmail stubs)
2. Folder/list views + thread view actions + read/unread
3. Drafts + compose (save/send) 
4. Agentic compose (both entry points)
5. Jev spam classifier + Spam view + flag banner
6. wzrdmail API PR (labels param, counts) — land independently; airv2 works
   with or without it
