# iMessage checkout handoff: implementation plan for GPT-5.6 Luna

Prepared 2026-09-14. Implementation tracking: local code and tests have changed; no production deployment, payment request, or purchase was made in this pass.

## Outcome and chosen approach

Make an owner-scoped **checkout mini-app link** the primary handoff for shopping. It must display the task, verified checkout details, the actual blocker, and a useful next action even when the remote desktop is unavailable. Keep remote control as an optional, same-session action for login, challenges, and checkout review. Do not generate new application code for each purchase: render a small first-party template from validated server-owned data.

Deliver in order:

1. Repair the confirmed desktop-readiness error and remove misleading connection status.
2. Add the independent checkout handoff, with native iMessage card and browser-link delivery.
3. Integrate Link agent payments separately from existing Stripe merchant checkout; add opt-in delegated approval only if the installed provider supports it.

Do not block the first two releases on agent-payment availability. Preserve current GMI inference routing, recovered history, every database backup, tenant isolation, and existing successful fast-answer behavior. This is not a model-provider migration, database recovery, or desktop-platform rewrite.

## Evidence: what is known, and what is not

### Confirmed production failure

Vercel runtime errors for `/mini/[app]`, **2026-09-14 16:06:40 UTC / 9:06:40 AM Pacific**, deployment `dpl_6LcySTC3RSxFmCBcMByBamvaiyHz`, commit `89722a491c05a4fbe30100621f6636146960b4a5`:

```json
{
  "msg": "computer mini-app failed",
  "provider_status": 400,
  "provider_code": "desktop_not_ready",
  "provider_message": "Desktop streaming is not ready for this box yet.",
  "provider_request_id": "req_be0fdbb93ec54135ba5756b7521518aa"
}
```

This is a sanitized extraction, not a complete raw event. It matches the screenshot's error text exactly.

Code path:

```text
Computer card → authenticated mini-app → ?view=live
  → desktopStreamUrlIfUp → requestDesktop → provider HTTP 400
  → BoxApiError → generic error page (no recovery action)
```

- `apps/web/lib/box/client.ts`: non-2xx replies throw `BoxApiError`; provider error details remain an opaque message.
- `apps/web/lib/box/desktop.ts`: an absent URL becomes `waking`, but a thrown `desktop_not_ready` is not normalized into a recoverable state.
- `apps/web/lib/miniapps/apps/passthrough.tsx`: that exception becomes the exact static failure shown by the user.
- `apps/web/lib/miniapps/apps/computer.tsx`: `ready`/`idle` database state enables the iframe and unconditional “Live” chip. This establishes power status, not video readiness. Its thumbnail branch is unreachable for an awake box because `embed` is always true in that case. It also mints a separate desktop URL merely to obtain an origin, before the iframe mints another.
- `apps/web/app/api/cards/computer/route.ts` and `browser/route.ts`: successful card delivery does not prove desktop readiness.
- `apps/web/lib/payments/link.ts`: merchant Link support is a feature-flagged environment allowlist, not an implemented merchant capability integration.
- `apps/web/lib/payments/linkAuth.ts`: box-side pairing exists, but does not verify the needed agent-payment grants. Existing checkout instructions require human submission on every purchase.

**Still unverified:** why this particular provider stream remains unready, whether VNC currently works for that box, and whether its active merchant tab shares the streamed display/profile. The Cloudflare challenge reported in chat is a separate merchant-side blocker, not the cause established by this Vercel event. Do not claim a CSP, DNS, or Cloudflare Worker fix will resolve this observed HTTP 400.

### mayor-coast comparison

Read-only reference checkout: `/Users/gratitud3/Documents/Codex/2026-09-08/imp/coast`.

- `src/app/api/draw/sessions/[id]/exchange/route.ts`: same-origin POST exchanges a launch secret for a secure browser session.
- `src/lib/draw/launch.ts`: fragment launch-secret parsing and HttpOnly/Secure/SameSite cookies.
- `src/app/api/stripe/creative-topup/route.ts`: server-owned order, reusable Checkout Session, `card` + `link`, stable order idempotency key, and top-level redirect.

Reuse these architectural patterns, not their fixed COAST price, order schema, or authorization assumptions. AIR already has mini-app token/session and Spectrum delivery helpers; extend them rather than adding Convex or another app host. COAST's Stripe checkout sells its own credits. It is not a way to collect money on our Stripe account and pay an unrelated ticket merchant.

## Phase 1 — desktop readiness and truthful recovery

### Files

Modify `apps/web/lib/box/{types,client,desktop}.ts`, `apps/web/lib/miniapps/apps/{computer,passthrough}.tsx`, and `apps/web/public/creator-os/computer.js`; add/extend their focused tests. Preserve both ASCII and Tenki adapter contracts.

### Implementation

1. Add structured, bounded provider-error parsing at the Box API boundary. Preserve status/code/request ID without logging response bodies, tokens, stream URLs, or arbitrary provider details. Keep existing `BoxApiError(status, message)` callers compatible. Recognize exact known codes, including nested error envelopes; do not classify all HTTP 400s as transient.
2. Treat `desktop_not_ready` and a successful response without a URL as `preparing` for an already-running machine. Distinguish this from `waking` a stopped machine. Preserve auth failures, missing boxes, start limits, and permanent failures as separate states. Do not repeatedly resume a ready box or report an arbitrary resume failure as definitely waking.
3. Introduce bounded readiness polling: initial check, then approximately 1/2/4-second delays with jitter; after about 8 seconds show the recovery choices. Stop automatic polling by 30 seconds and offer an explicit retry. Persist the deadline for the attempt so refreshes cannot reset an infinite loop. Cancel on navigation and deduplicate concurrent requests for the same owner/box. Cap each provider request within the readiness budget; today's 60-second default must not hold up the mini-app shell.
4. Render the shell immediately from task state. Show `Preparing screen`, `Connecting`, `Unavailable`, or `Connected` separately from `Power: on`. A minted URL is not proof that video connected. Use an authenticated/validated viewer-ready signal if the provider supports one; otherwise label the state conservatively. Iframe `load` alone is not a video-health signal. Pin any `postMessage` source and exact allowed origin; never accept wildcard messages.
5. Offer **Open full screen**, **Try VNC**, and **Open merchant site** when applicable. VNC opens top-level, not in an iframe. Issue a fresh owner-authorized redirect for each viewer launch; never expose raw desktop URLs in mini-app JSON, logs, cards, or persisted records. Remove the duplicate origin-only desktop mint if provider metadata permits; do not replace it with an unsafe guessed origin or wildcard target.
6. Make snapshot fallback genuinely reachable, optional, bounded, and owner-only. Label capture time and “Not interactive”; never call a screenshot a live browser. Disable screen capture while the human is entering secrets or payment details.
7. Diagnose the underlying provider failure with read-only box state, display/browser/profile identity, and sanitized service-health checks. If it persists, capture the provider request ID for support. Do not stop/recreate the box, reset the browser profile, expose a public desktop, or install another remote-control service as a speculative fix. Such a change requires its own reviewed recovery path and preservation of the active cart.

## Phase 2 — checkout handoff mini-app and delivery

### Data and interface

Add proposed `apps/web/lib/checkout/handoffs.ts` plus an additive Supabase migration using the next available migration number. Use a durable `checkout_handoffs` record with owner, original conversation, task/run ID, state/version, merchant origin, safe launch URL, item/quantity, quote/verification time, final amount/currency when known, cart expiry, same-session requirement, and optional payment-request reference. Keep PII and credential-bearing cart links out of public metadata; encrypt sensitive server-side references where necessary. Apply owner RLS plus authorization at every service-role access. Use one logical handoff per task; versioned conditional transitions prevent late workers overwriting newer state.

Suggested lifecycle:

```text
preparing → needs_human → ready_for_review → payment_pending → completed
     ↘ failed / expired / cancelled
payment_pending → requires_action / unknown_outcome
```

State-specific resume transitions require fresh checks. An approval, redirect, or “Done” tap is not a completed purchase.

Add proposed `apps/web/lib/miniapps/apps/checkout.tsx`, register it in `apps/index.ts`, and add the `mini_apps` registry row, nested route mapping, card kind, and copy. Use existing `MiniAppContext` authorization and bind the handoff ID as its resource. Add authenticated status and POST-action handlers within existing mini-app conventions; do not create unauthenticated parallel endpoints.

The page must render without a Box call and show:

- Item, merchant, quantity, verified total including fees/taxes, and verification/hold time. Unknown values must say unknown; do not promote the screenshot's discount claim into verified data.
- A specific blocker, e.g. “The merchant needs you to complete verification.”
- **Continue on merchant site** whenever there is a validated destination.
- **Control the existing browser** only as the same-session route; show actual readiness and a top-level VNC alternative.
- **Review / Approve with Link** only when a real request is available and eligible; otherwise show setup, waiting, unsupported, or manual checkout explicitly.
- Cancel, expired-state recovery, and a clear completion/receipt state.

### Handoff rules

- Use a reusable, authenticated landing route. Launch redemption should require actual user navigation/action, not be consumed by a link-preview crawler. For the new sensitive handoff, adapt COAST's fragment + same-origin POST exchange or extend AIR's current gate with equivalent preview protection. Atomic single-use redemption, scoped secure cookies, `no-store`, `no-referrer`, URL cleanup, and replay tests are required.
- Messages webview cookies may not carry into Safari. Provide a separately minted, short-lived browser handoff capability from the authenticated page; never reuse an already-consumed launch token. Payment approval must still require owner identity or explicit Link approval, not mere possession of a forwarded link.
- Validate destination scheme, merchant identity, and redirects. Reject script URLs, open redirects, cross-owner resource IDs, and backend SSRF to private/metadata addresses. Never iframe/proxy the merchant checkout to evade its security restrictions.
- A merchant URL opened on the phone normally does **not** transfer the remote browser's cookies/cart/queue/challenge clearance. Say so. Prefer a merchant-supported portable cart URL if verified; otherwise label the action “Open merchant site — you may need to rebuild the cart.” Do not promise an authenticated final checkout page when none is transferable.
- Pause the agent's browser-input tools with an owner/task-scoped lease while the human controls that browser. Renew the existing box idle lease for a bounded handoff window. Resume only after an explicit user hand-back and rechecking the same tab/profile, challenge state, cart hold, quote, and authorization. Never infer completion from an elapsed timer. Do not record human passwords, codes, or payment fields.
- Cloudflare challenges must remain a human/merchant-supported flow. Do not use solver services, copy clearance cookies, disable merchant protections, or promise that human input into an automated browser will necessarily work.

### iMessage wiring

Extend `apps/web/lib/miniapps/{cards,cardSends,cardSessions}.ts`, `apps/web/lib/spectrum/sender.ts`, and the agent-facing card route/contract. Use a dedicated checkout handoff action rather than broadening generic computer access. Preserve durable owner destinations and pinned sender lines; never use a contact's latest queue row to route the owner's screen or wallet approval.

Use native Spectrum app cards where supported, plus an explicit **Open checkout** browser link; handle native-card unsupported responses with a rich-link/text fallback. Each channel gets a separately scoped launch capability. Bind delivery retries to a stable provider-supported message identity and durable send state; an uncertain send is reconciled before retrying, not blindly duplicated. Update the same handoff card rather than sending a new card for each status transition.

Update `infra/template/skills/{computer-relay,shopping-checkout}/SKILL.md` with the typed handoff contract. The agent must provide the actual merchant link and blocker immediately, not only a Computer card. At `needs_human`, cancel generic progress timers in `apps/web/lib/orchestrator/ttfk.ts` / related orchestration hooks. Progress must describe real state; never send “finalizing” when blocked. Keep acknowledgment as a maximum latency budget, not a mandatory delay before a useful result.

## Phase 3 — Link compatibility and carefully scoped automatic approval

### Keep three payment paths distinct

| Situation | Correct path |
| --- | --- |
| AIR/connected merchant sells its own product | Existing Stripe Checkout / Express Checkout, with Link enabled and server-derived order data |
| Agent buys from an unrelated merchant | Per-user Link agent-payment authorization and SpendRequest, or manual merchant checkout |
| Merchant does not support the available agent-payment method | Human checkout; do not fabricate a Stripe pay link or route the purchase through AIR's Stripe account |

Existing AIR anchors: `lib/payments/{link,linkAuth,stripe}.ts`, `lib/commerce/{checkout,paymentRequests}.ts`, `app/api/browser/purchase/route.ts`, and purchase-review decision handling. Introduce proposed `lib/payments/linkSpend.ts` and `approvalPolicy.ts` only after verifying the installed CLI schemas.

### Capability and authorization

1. On the **owner's box**, first run `link-cli auth status --format json` using its isolated auth path. Inspect installed version and exact `--schema`/`--llms-full` output. The local workstation's CLI was not installed during planning; no Link authorization was initiated. Avoid interpreting that as the box's install state.
2. Verify reported `userinfo:read payment_methods.agentic` grants. Upgrade insufficient existing authorization rather than overwriting it; do not treat missing grant metadata as proof of access. Correct pairing's current unscoped flow, error masking, and assumptions about response shape against the installed version. Never centralize all users on one Link wallet.
3. Select credentials from verified merchant capabilities: ordinary card checkout may use a single-use virtual card; LPT requires the documented AI-agent steering flow and both `link_pay_token` and `data-stripe-merchant-account` markers in the appropriate checkout frame; compatible HTTP 402 Stripe MPP can use its shared-payment-token flow. Do not assume AXS supports LPT or MPP. These markers are capability inputs, not instructions granting spending authority.
4. Create an idempotent request only after identifying the merchant, exact item, total including fees, and currency. Store status/IDs and sanitized audit metadata, not raw card/SPT/LPT values. Keep credentials within the owner's secure execution boundary and out of prompts, browser analytics, session recordings, screenshots, stdout, and database rows. If a CLI output file is unavoidable, use restrictive permissions, minimal lifetime, and verified cleanup.
5. Handle pending approval, denial, expiration, cancellation, `requires_action`, and unknown outcome explicitly. Follow provider `next_action.resolution` semantics, including whether to resume the same request or create a replacement after resolution. Persist and reconcile the attempt before any replacement charge. Use verified merchant confirmation/provider status or signed matched webhooks where available; never treat a success URL as settlement.

### Automatic approval is a separate, opt-in feature

Default to human confirmation, matching the screenshot. Device pairing is not purchase authorization. A user may enable delegated approval with a server-enforced policy binding owner, merchant, currency, transaction ceiling, aggregate budget, item/category scope, expiry, revocation, and supported provider capability. Recheck at execution, atomically reserve/release budget, and invalidate approval if the cart changes. Never let an LLM, webpage, contact, or generic “yes” create a blanket policy.

The supplied payment skill describes `approval_detail` for delegated/pre-approved flows; Link's public agents page currently presents per-purchase confirmation and labels granular controls as forthcoming. **Therefore capability support is a release gate, not an assumption.** Implement the policy evaluator and test adapter now, but leave production automatic approval disabled unless the actual account/CLI contract supports it and the owner has opted in. Populate approval evidence from a real authenticated approval event/policy evaluation; do not fabricate timestamps, biometric claims, or clicks. If Link requests user action, honor it rather than bypassing it.

Keep existing vault fill authorization and human-submit behavior unchanged outside the separately gated Link flow. Document the narrow new exception consistently in `SECURITY-DECISIONS.md` and the shopping skill; do not delete the existing payment stop globally.

## Tests, latency goals, and completion evidence

### Baseline actually run during planning

```bash
npm run test --workspace apps/web -- lib/box/desktop.test.ts lib/miniapps/apps/computer.test.ts lib/miniapps/cards.test.ts lib/payments/linkAuth.test.ts
```

**Result: 4 files, 28 tests passed; Vitest duration 893 ms.** These are existing mocked unit tests, not end-to-end proof. The desktop suite covers an undefined URL but not the production `BoxApiError(400, desktop_not_ready)` case; the UI suite currently expects a Live iframe for any awake box. No new regression tests or live purchases were executed in this planning pass.

### Required new regression matrix

| Test | Required result |
| --- | --- |
| Exact recorded provider error envelope | Red test first; then `preparing`, not static generic failure |
| Ready after N checks; never ready; 401/403; missing box; 429 | Bounded recovery and specific state; no resume storm or infinite refresh |
| Slow origin probe/provider timeout | Mini-app summary and actions still load independently |
| VNC/fullscreen; actual viewer readiness | Top-level authorized launch; no false Connected/Live status |
| Native card unsupported; uncertain send; repeated click | Usable browser link, deduplicated delivery, no duplicate checkout |
| Link preview, reload, expired token, replay, cross-owner access | Preview-safe launch; correct re-entry; no owner session or payment leakage |
| iMessage sheet → Safari | Fresh scoped exchange works without assuming shared cookies |
| Human controls browser | Agent input suspended; same profile preserved; expired holds revalidated |
| Merchant cart cannot transfer | Explicit manual-rebuild path; no claim that remote cookies transferred |
| Unverified price/discount or changed total | No approval of guessed amount; fresh review required |
| Link unpaired/insufficient grants/unsupported method | Upgrade/setup/manual fallback, not a dead or fake approval button |
| Approve/deny/expire/requires_action/duplicate callbacks | Correct durable state; one logical spend attempt |
| Policy limits, expiry, revocation, concurrent purchases, foreign sender | Fail-closed checks; atomic budget; no cross-user approval |
| Payment timeout after possible submission | `unknown_outcome` and reconciliation; no automatic double purchase |
| Secret-canary values in provider fixtures | Absent from logs, HTML, card metadata, tracing, and persistence |
| Blocked or completed task | No generic 10/20/35-second “working/finalizing” message cascade |

Run focused tests, then `npm run typecheck`, `npm run lint`, the complete relevant suite, and production build. Add browser integration tests and real-device validation in the Photon Messages sheet and Safari; mocked rendering cannot prove WebRTC/VNC, touch input, cookie exchange, or popup behavior. Run human challenges manually, not with a CAPTCHA-solving test. Use provider-supported sandbox payment tests; LPT may not offer test mode, so mock its contract and clearly label live validation as pending. No live purchase just to make CI green.

Measure separate timestamps: inbound received, reaction accepted, useful reply accepted, handoff sent/opened, shell visible, stream requested/ready, human action required, payment requested/confirmed. Record provider latency separately from application latency. Goals, not guarantees:

- Reaction within 1 second of server receipt; useful result or handoff within 5 seconds when available.
- Warm mini-app shell actionable within 2 seconds p95, independently of desktop readiness.
- Blocker/handoff emitted within 2 seconds of detection; desktop fallback visible within 8 seconds of viewer request.
- No fabricated progress. Long merchant queues/challenges become an explicit waiting state, not a promised purchase within 45 seconds.

Report sample count, p50/p95, failures, and real-device evidence. Include a simple-arithmetic regression to ensure checkout work did not reintroduce slow-agent routing or filler messages for fast answers.

## Rollout and handoff to Luna

1. Recheck branch/worktree, relevant AGENTS/skills, and production deployment. Add the failing readiness fixture before coding.
2. Ship Phase 1 independently. Canary an approved test owner using the affected provider type. If its desktop stays unavailable, report that honestly; the fallback must still be usable.
3. Add the handoff schema with owner RLS and backward-compatible reads, then deploy the mini-app and agent contract behind a per-user feature flag. Register the app row before enabling card issuance. Verify native and browser entry points before broad rollout.
4. Use existing Vercel project `prj_k85SYkCP3elo3YIChN6o45gEbsRC`, team `team_PYXAVq4jrHw8k0bNffmhc2jE`, and `mini.wzrd.tech`. Reconfirm identifiers before deployment. No new domain or Cloudflare Worker is needed for this first-party route; existing `infra/workers/wrangler.toml` targets published `*.apps.wzrd.tech` apps. Only change CF routing if diagnostics establish a separate issue. Never proxy the stream to work around merchant challenges.
5. Ship Link capability detection/manual approval separately, then enable delegated approval only after the explicit capability and owner-policy gates. Deploy updated box skills through the existing supported sync path, preserving credentials, profiles, and backups.
6. Roll back with feature flags and the prior app version; leave additive tables and audit records intact. Continue reconciling any in-flight payments when new initiation is disabled. Never erase an unknown payment attempt or restore an older database over live payment state.

**Luna implementation brief:** Implement this plan in the stated order, keeping each phase reviewable. Do not expand into new inference providers, a general app generator, or a new remote desktop stack. Validate each boundary with tests, preserve unrelated work, and report what is shipped versus pending. Ask for an explicitly scoped live-payment authorization if one is needed; this plan authorizes no charge. Deliver the changed-file summary, test results, actual latency measurements, deployment/version, rollback switch, and any remaining provider limitation. Do not claim the fix complete merely because a card sends or all mocks pass.

## Primary references

- [ASCII desktop streaming](https://docs.ascii.dev/box/desktop-streaming): authenticated viewer launch, VNC top-level requirements, and lifecycle caveats. Do not enable public access.
- [Cloudflare supported browsers](https://developers.cloudflare.com/cloudflare-challenges/reference/supported-browsers/) and [challenge limitations](https://developers.cloudflare.com/cloudflare-challenges/concepts/how-challenges-work/): embedded-browser limits, unsupported automated challenge solving, and session/IP constraints.
- [Stripe Link with Checkout](https://docs.stripe.com/payments/link/checkout-link): merchant Checkout integration and payment-method configuration.
- [Link for agents](https://link.com/agents): user-controlled spend approvals and current public capability description.
- Local Link CLI/create-payment-credential, Photon CLI, and Spectrum skills supplied with this task. Recheck CLI schemas at implementation time; the plan does not assume undocumented flags or universal merchant support.
