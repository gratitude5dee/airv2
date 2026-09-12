plan.md — `/trade` and the Trade mini-app (approval-gated spot trading in Air)

Read `ARCHITECTURE.md` and `docs/goal-miniapps-v9.md` in full before starting. Where this file and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins and this file is the bug.

Reference implementation: **Adaam** (`Must-be-Ash/adaam`, an Eve agent — "guarded brokerage via Coinbase"). We are porting its *safety model*, not its code. Adaam runs one agent for one owner on one Vercel deployment with one shared Coinbase key. Air runs a fleet of per-user boxes behind one control plane. Every place where those two shapes differ is called out below; the differences are where the bugs will come from.

---

## 0. The outcome

A user texts (or types in `/home`):

```
/trade                         → the Trade mini-app card (portfolio, ticket, orders, watchlist)
/trade buy $50 of BTC          → agent previews the exact order → one Approve/Deny card → filled → receipt
/trade sell half my ETH        → same, sized against the live available balance
/trade portfolio               → holdings + P&L, in chat, no card required
/trade orders                  → open/recent orders; `/trade cancel <id>` needs approval
/trade watch SOL > 200         → a price alert, delivered on the same line
/trade connect                 → connect a Coinbase Advanced Trade key (or stay in paper mode)
/trade paper | /trade live     → switch mode
```

**Every mutation of money — create, edit, cancel an order; convert; transfer — happens only after the owner taps Approve on an exact, expiring preview.** Reads (balances, prices, orders) are free. The agent can *stage*, never *execute*. That is the same contract the platform already enforces for `payment_request`, `purchase_review`, and `shop_publish` (`apps/web/app/api/decisions/route.ts`); trading is one more decision kind on the same rails, not a second approval system.

### 0.1 What Trade is not

- Not a brokerage. Air never custodies funds; the user's own Coinbase portfolio (or, later, their own onchain wallet) holds everything.
- Not investment advice. Every surface carries the same "research support, not advice" posture Adaam has in `00-shared.md`.
- Not perpetuals, futures, margin, leverage, or withdrawals to external addresses. Spot only, forever, by allowlist.
- Not autonomous. No trade ever originates from a scheduled run, a watchlist trigger, an inferred preference, or a prior conversation. A watch alert *tells* the user; it does not *act*.

### 0.2 Golden paths

1. **Day-one, no key:** `/trade` opens the mini-app in **paper mode** with a $10,000 simulated USD balance against live Coinbase public prices. `/trade buy $50 of BTC` runs the *whole* preview → approve → fill loop against the simulated book. The approval card, ledger, receipts, and P&L are identical to live. Paper mode is a product feature, not a test fixture — and it is also our eval fixture (Adaam's `coinbase-eval-fixture.ts`, made user-facing).
2. **Connect:** `/trade connect` → mini-app Settings → paste Coinbase key ID + secret (owner-only, mini origin, sealed server-side; C18). Status chip flips to `● coinbase · <portfolio name> · live`. Mode is still paper until the owner explicitly taps **Go live**.
3. **Live trade:** `/trade buy $50 of BTC` → agent calls the control plane: resolve product → read available balance → **preview** (Coinbase's own preview: est. fill, fees, slippage) → files a `trade_order` decision → owner gets one card: *Buy 50 USD of BTC · est. 0.00048 BTC · fee $0.30 · expires in 4:52 · [Deny] [Approve]* → Approve runs the order **inside the decision resolver** with a client order id derived from the preview → receipt line in chat.
4. **Chained request:** "Sell 50% of my BTC and buy SOL with it" is two tasks. The sell runs to a fill; the agent reports the *realized* proceeds and asks whether to proceed; the buy is sized from a fresh balance read, never from predicted proceeds (Adaam `coinbase.md` §"One order per approval, and stop").

---

## 1. Existing substrate — audit before you write code

Do not rebuild any of this. Extend it.

| Subsystem | Where | State / what we reuse |
|---|---|---|
| iMessage slash → mini-app card | `apps/web/lib/miniapps/imessageCommand.ts` (`parseMiniAppCommand`, `maybeSendMiniAppLink`, `ALIASES`) and the call site in `apps/web/lib/orchestrator/flush.ts` (~L662) | Live. Only matches a *bare* `/slug`. `/trade` alone rides this unchanged. `/trade <args>` needs a new parser (§4). |
| Web chat command dispatch | `apps/web/app/api/chat/route.ts` (`parseExplicitGenerationCommand` runs before `startChatRun`) | Live for `/imagine /animate /zap` only. `/trade` gets its own branch here; do **not** add it to `lib/creative/parse.ts` (that lane is paid generation with its own daily cap and job table). |
| Job-lane shape to mirror | `apps/web/lib/creative/run.ts` `executeCreativeJob` (create row → `after()` executor → lifecycle → user line) | Live. The trade lane copies the *shape* (row first, executor second, user-facing `line`), not the code. |
| Mini-app module contract | `apps/web/lib/miniapps/apps/types.ts` `MiniAppModule { render, action?, guestActions?, publicAccess? }`, registry `apps/index.ts` `FIRST_PARTY_MODULES` | Live. One new module, one new line, one `mini_apps` row. |
| Registry + loader + gates | `supabase/migrations/0007_miniapps.sql`, `apps/web/lib/miniapps/registry.ts`, `app/mini/[app]/route.ts`, `lib/miniapps/gates.ts` | Live. `visibility='private'`, `access='single'`, `status='published'`. The loader verifies the link; the module never parses a token (MA2). |
| Signed links / cards | `lib/miniapps/cards.ts` `mintSignedLink`, `POST /api/mini/link`, `cardSends.ts` `CardKind` (+ check constraints, see `0057_feedback.sql`) | Live. Add `trade` to `CardKind` so the agent may send the card; add `trade_order` as an approval card kind (§5.4). |
| Box-side document state | `lib/miniapps/store.ts` `readAppState`/`writeAppState` → `.hermes/miniapps/trade/*.json`, `stateLease.ts` `withStateLease` | Live. C4: watchlist, paper ledger, and the *last portfolio snapshot* live in the box document so the agent and the view read the same file. |
| Decisions / Needs You | `decisions` table (`0005_trust_decisions.sql` + later kind widenings), `GET/POST /api/decisions`, `apps/web/app/home/panels/needs-panel.tsx` | Live. New kind `trade_order` (and `trade_cancel`). **Side effects run only in the resolver**, guarded by the conditional `status='pending'` flip so two taps cannot double-submit. |
| Deep-link approvals | `lib/approvals/token.ts` (`mintApprovalUrl`, 15-min HMAC, `use:"approval_link"`), `app/approve/[id]`, `api/approvals/[id]`, `lib/approvals/hosted.ts` `resolveHostedDecision` (value-free view, C18) | Live. The iMessage Approve/Deny for a trade is this page, with a trade renderer. |
| Box → control plane auth | `Authorization: Bearer <boxes.gateway_token>` per route; exemplar `app/api/miniapps/commerce/route.ts` ("the agent can only STAGE") and `infra/template/skills/link-payments/SKILL.md` for the `${OPENAI_BASE_URL%/api/gateway/v1}/api/...` pattern | Live. `/api/trade/*` copies `miniapps/commerce` exactly. |
| Per-user sealed secrets | `lib/providers/keys.ts` (`PROVIDER_VAULT_KEY`, secretbox, last-4 hint, server-only read), `lib/crypto/secretbox.ts` | Live. The Coinbase secret is stored the way a user's OpenRouter key is stored. It never reaches the box, the browser, or a log. |
| Money already in the repo | `lib/payments/x402.ts` (`@coinbase/x402` facilitator, `CDP_API_KEY_ID/SECRET`), `lib/thirdweb/client.ts` + `lib/wallet/send.ts` (server-managed wallets, USDC on Base, `WalletSubmitUnknownError` never auto-resubmitted — C23), `lib/commerce/paymentRequests.ts` | Live. **No Coinbase Advanced Trade / spot code exists.** C23 ("uncertain submit is terminal, never retried") is the rule trading inherits verbatim. |
| First-party box skills | `infra/template/skills/<name>/SKILL.md`, `base-skills.txt`, `sync-box.sh`/`verify-box.sh` | Live. New `infra/template/skills/trade/SKILL.md`, a port of Adaam's `coinbase.md` rewritten against `/api/trade/*`. |
| Adaam — order schema & preview token | `agent/lib/coinbase-order.ts` (`coinbaseOrderSchema`, `createOrderPreviewToken`/`verifyOrderPreviewToken`, `clientOrderIdForPreview`) | Reference. Port nearly verbatim into `lib/trade/order.ts`; rebind the principal hash from a chat principal to `user_id`. |
| Adaam — mutation idempotency | `agent/lib/coinbase-operation-store.ts` (`started → succeeded | uncertain`, `nx` insert, 30-day TTL) | Reference. We have Postgres; this becomes the `trade_orders` state machine, not Redis. |
| Adaam — approval mini-app | `agent/channels/photon-approval-app.ts`, `agent/lib/photon-approval.ts` (`orderApprovalSummary`, order expiry = min(preview expiry, 5 min), thread-bound `YES`/`NO` fallback) | Reference. Summary text and expiry rule port as-is. The `YES/NO` text fallback is **new** for Air (§5.5). |
| Adaam — Coinbase transport | `agent/lib/coinbase-mcp.ts` spawns `@coinbase/coinbase-cli mcp` over bounded stdio | Reference only. See §7.1 for why we do **not** spawn a child MCP inside a Vercel function. |
| Adaam — evals | `evals/coinbase/*.eval.ts` (order approval, denial, balance language, chained-trade decomposition) | Reference. These four become the acceptance tests for the skill (§9). |

---

## 2. Non-negotiable constraints

Cross-cutting constraints keep their `ARCHITECTURE.md` / `goal-miniapps-v9.md` numbers. New trade invariants are **T1–T9** and are cited from code comments (`plan.md §T3`).

| # | Constraint as it applies here |
|---|---|
| I1–I6 | Unchanged. In particular: the box never holds a control-plane secret, and the control plane is the only holder of third-party money credentials. |
| C3/C16 | No box `_token`, `API_SERVER_KEY`, or box URL reaches the mini-app. All box I/O through the control plane. |
| C4 | Watchlist, paper ledger, last portfolio snapshot → box document `.hermes/miniapps/trade/`. Postgres holds routing/ledger metadata only (`trade_connections`, `trade_orders`): no holdings table, no P&L table. |
| C5 | Outbound hosts: exactly `api.coinbase.com` (Advanced Trade) and `api.exchange.coinbase.com` or the public `api.coinbase.com/api/v3/brokerage/market/*` endpoints for unauthenticated prices. Allowlisted by literal; no user-supplied URL. |
| C17 | Mini-app persists nothing in the browser. No `localStorage`, no service worker cache of balances. |
| C18 | The browser sees `key id · last 4`, portfolio *name*, and status; never the secret, never a recoverable masked value. The key form is write-only; rotating means re-entering. |
| C23 | An order submit whose outcome is unknown (timeout, 5xx after send, connection drop) is terminal `uncertain`. It is **never** resubmitted automatically. The user is told to check the Orders tab; reconciliation reads Coinbase state by `client_order_id`. |
| MA1/MA2/MA4/MA5 | `mini.wzrd.tech/trade` is its own origin; slug is routing, claims authorize; `access='single'`, no guest surface; every gate runs server-side in the module. |
| MA10 | The agent does not learn "the Trade mini-app exists". It calls `/api/trade/*` via the skill and reads/writes `.hermes/miniapps/trade/*.json`; the view renders that state. |
| **T1 — Stage, never execute.** | Every box-authenticated `/api/trade/*` route is read-only *or* creates a `pending` decision. The only code that calls Coinbase's order-create/edit/cancel/convert/transfer is the decision resolver under an owner session or a valid approval-link token. |
| **T2 — Exact preview, bound and expiring.** | An approval is for one canonical order `{productId, side, type, size fields}` hashed into a signed preview token, bound to `user_id`, valid ≤5 min. Any field change invalidates it. The approval card renders from the token payload, never from free text. |
| **T3 — One active approval per user.** | A second `trade_order` decision while one is `pending` is refused (409) with the pending order named. Chained requests decompose (§0.2 #4). |
| **T4 — Spot only, online only.** | Before preview *and* again before submit, `product_type === "SPOT"` and `status === "online"` are re-verified from Coinbase. Never substitute `ETH-USD` for `ETH-USDC`. |
| **T5 — Idempotent submit.** | `client_order_id = uuidv4-from-sha256(previewToken)`. Retrying a resolver call with the same token cannot create a second order; Coinbase dedupes on it, and so do we (`trade_orders.client_order_id unique`). |
| **T6 — Caps are the owner's, enforced server-side.** | `per_order_usd_cap` (default 250), `daily_usd_cap` (default 1,000), spot-only allowlist. Raising a cap is itself a `trade_settings` decision. Paper mode has no caps. |
| **T7 — Never from a scheduled or unattended run.** | Routes that create a `trade_order` decision require the run to carry an interactive origin (`surface ∈ {imessage, web, miniapp}`) in the gateway-token context; cron/automation/watch dispatches get 403. |
| **T8 — Owner-only, everywhere.** | `senderTier !== 0` on iMessage, `role !== "owner"` in the mini-app, non-owner web session → refusal before any Coinbase call. Approval links are owner-minted and 15-min. |
| **T9 — Not advice, not certain.** | No surface says "will", "guaranteed", or ranks assets as recommendations. Previews are "estimated". Copy is reviewed against Adaam `00-shared.md` §Response style. |

---

## 3. Non-goals (v1)

- Non-Coinbase venues, onchain DEX swaps, bridging. (§10 lists the onchain option as the first follow-on because the platform already has thirdweb wallets holding USDC on Base.)
- Strategy packs / monitors / congressional & commentary signals (Adaam's bulk). Watchlist price alerts only.
- Multi-user portfolios, shared accounts, or an operator-held pooled key (Adaam's model). Per-user BYO key only.
- Charts beyond a sparkline. Research artifacts (`publish_chart`) are a separate lane.
- Fiat on/off-ramp. If the user has no USD/USDC in the portfolio the ticket says so and links Coinbase.

---

## 4. The `/trade` command

### 4.1 Grammar

```
/trade                                   → card (iMessage) | open mini (web)
/trade help
/trade connect | paper | live
/trade portfolio | balance | positions
/trade orders [open|recent]
/trade cancel <order-id | last>
/trade watch <SYMBOL> (>|<|above|below) <price> | /trade unwatch <SYMBOL>
/trade <anything else>                   → agent turn with the trade skill primed
```

Only the first token after `/trade` is parsed deterministically. Everything else — "buy $50 of BTC", "sell half my ETH", "dump my SOL at 210 limit" — is a natural-language agent turn. Order sizing and product resolution are the agent's job *via tools*, never regex. This is the Adaam split: `coinbase_preview_order` is a tool, the words are the model's.

### 4.2 Parser

New `apps/web/lib/trade/parse.ts`:

```ts
export type TradeCommand =
  | { kind: "card" }
  | { kind: "help" }
  | { kind: "mode"; mode: "paper" | "live" | "connect" }
  | { kind: "portfolio" }
  | { kind: "orders"; scope: "open" | "recent" }
  | { kind: "cancel"; ref: string }
  | { kind: "watch"; symbol: string; op: ">" | "<"; price: string }
  | { kind: "unwatch"; symbol: string }
  | { kind: "agent"; text: string };
export function parseTradeCommand(input: string): TradeCommand | null; // null ⇒ not a /trade message
```

- Matches `^\/trade(\s|$)` case-insensitively, single leading token, ≤ 2,000 chars.
- Returns `null` for any other text so both dispatch sites fall through untouched.
- Pure; colocated `parse.test.ts` covers every arm plus `/trader`, `/trade\n`, `/TRADE  buy`.

### 4.3 Dispatch sites (two, both hardcoded today — keep it that way, no registry)

**iMessage** — `lib/orchestrator/flush.ts`, immediately *before* the existing bare-`/slug` mini-app branch:

```ts
const trade = parseTradeCommand(body);
if (trade) { await runTradeCommand(supabase, sender, job, trade); return; }
```

`runTradeCommand` (`lib/trade/imessage.ts`) handles `card` by delegating to `maybeSendMiniAppLink` (so `/trade` alone keeps today's exact behavior, tier check included), answers `help|portfolio|orders|watch|unwatch|mode` deterministically from `/api/trade`-equivalent server functions (no model call), and hands `agent` and `cancel` to a Hermes turn on `MAIN_SESSION` with `{surface:"imessage", lane:"trade"}` metadata and the skill text pre-loaded. The debounce window (`debounceMsFor`) treats `/trade` like a creative command (3 s) so "…of BTC" typed as a second bubble is caught.

**Web chat** — `app/api/chat/route.ts`, before `parseExplicitGenerationCommand`: same parser; `card` returns `{ openMini: "trade" }` which the `/home` shell already knows how to turn into a `POST /api/mini/link` + dock open (the Apps-tab path). Everything else streams as a normal turn with the same metadata.

**Deterministic answers never touch the model.** `/trade portfolio` is a read + a formatter; if the agent were in the loop it would cost a turn and could hallucinate a balance. This is where the `/trade` lane differs from `/imagine`: half its surface is a command, not a prompt.

### 4.4 Help text

There is no central `/help` in the repo. `/trade help` returns its own 8-line card; the `open-miniapp` and new `trade` skills mention `/trade` so the agent can suggest it. Add `trade` to `ALIASES` under `trading`, `portfolio`, `coinbase`.

---

## 5. The Trade mini-app — `mini.wzrd.tech/trade`

### 5.1 Module

- `apps/web/lib/miniapps/apps/trade.tsx` exporting `export const trade: MiniAppModule`; server HTML via `renderShell`/`shellHtml` like `connect.tsx`/`calendar.tsx`. No client bundle beyond the ≤ 3 KB inline script the shell already allows (countdown timer, tab switch, optimistic disable on Approve).
- `render` and `action` both `forbidden("this view is owner-only")` when `ctx.session.role !== "owner"`. `guestActions` absent. Unknown action → `forbidden`, never a redirect pretending success.
- Helper lane `apps/web/lib/trade/` (see §7). **No `fetch` to Coinbase from the module file**; it calls lane functions only.
- Colocated `trade.goal.md` (this plan, distilled to the app), `trade.test.ts`, `trade-ticket.test.ts`, `trade-approve.test.ts`.
- Registry row in `supabase/migrations/0109_trade_miniapp.sql`: `slug='trade'`, `route='/mini/trade'`, `kind='render'`, `visibility='private'`, `access='single'`, `status='published'`, `plugin_signin_enabled=false`, `scopes='{trade:manage}'`; plus `CardKind` widening for `trade` and `trade_order`.

### 5.2 Information architecture (five tabs, one screen each, no modals)

| Tab | Shows | Actions (all POST → `action`) |
|---|---|---|
| **Portfolio** | Mode chip (`paper` / `● live · <portfolio>`), total value, 24h Δ, available USD/USDC, holdings table (asset · qty · value · 24h · allocation bar), 7-day sparkline of total value from the box snapshot log | `refresh` (re-reads Coinbase + writes snapshot), `go-live`/`go-paper` (mode; go-live requires a connected key and is itself confirmed inline) |
| **Trade** | The ticket: product picker (search over online SPOT products), Buy/Sell segmented, Market/Limit/Stop-limit, one size field that flips between quote and base per Adaam's size rules, live price, **Preview** button | `preview` → renders the exact preview block (est. fill, fee, slippage, total, expiry countdown) with **Deny / Approve** → `approve` / `deny` (§5.4) |
| **Orders** | Pending approval (with countdown), open, recent fills; each row: product · side · size · status · time · id (copyable) | `cancel <id>` → creates a `trade_cancel` decision → inline Approve |
| **Watch** | Watchlist rows: symbol · last · rule (`> 200`) · state (`armed`/`fired <time>`) | `watch-add`, `watch-remove`, `watch-rearm` (writes `.hermes/miniapps/trade/watchlist.json` under lease) |
| **Settings** | Connection card (status chip, key id · last 4, portfolio name, **Connect / Rotate / Disconnect**), caps (per-order, daily) with current-day usage bar, disclosure text | `connect` (write-only form: key id, secret PEM), `disconnect`, `caps` (files `trade_settings` decision when raising) |

Prompt bar (`lib/miniapps/promptBar.ts`) is enabled on Portfolio and Trade with `{app:"trade", resource:"ticket"}` so "buy $50 of BTC" typed here is the same agent turn as `/trade buy $50 of BTC` and the ticket re-renders with the preview.

### 5.3 Design language

Trade adopts the current `/home` dashboard tokens (`lib/miniapps/shell.ts`) and stays *quieter* than a brokerage app. Principles, in priority order:

1. **Numbers first.** Tabular figures (`font-variant-numeric: tabular-nums`), right-aligned, one weight heavier than labels. Currency always with code (`50.00 USD`), crypto to product precision (`base_increment`), never rounded in the approval card.
2. **Side is color, color is only side.** Buy = the palette's green, Sell = its red, nothing else uses those hues. P&L uses neutral-positive/neutral-negative tints, not the trade colors, so a red row is never mistaken for a sell.
3. **The approval card is a receipt, not a button.** It shows every field Coinbase will see — product, side, type, size, est. fill, fee, slippage, total, expiry — in the same order every time. Approve is the last element, full width, the *only* filled button on screen; Deny is a text button beside it. Approve disables itself at expiry and on first tap (C23: one tap, one submit).
4. **No motion that could read as market movement.** No pulsing, no ticker tape. The only animation is the expiry countdown and a one-shot "filled" check.
5. **Same screen on iMessage and web.** The card in Messages *is* the mini-app at 375 px; there is no separate compact layout. Tabs collapse to a bottom bar under 480 px.
6. **Disclosure is visible, not buried.** One short line under every preview: "Estimates. Not investment advice. You approve every order."

### 5.4 Approve/Deny — where execution actually happens

Three surfaces, one resolver:

- **Mini-app `approve` action** → `resolveHostedDecision(id, "approve", { session })` (`lib/approvals/hosted.ts`), the same call `payment_request` uses.
- **Needs You panel** (`/home`) → `POST /api/decisions` with the trade kinds added to the switch.
- **iMessage** → the agent's turn sends a `trade_order` card (`sendMiniAppCard` with the Approve view pre-selected). Fallback when the card can't be sent: `mintApprovalUrl(id)` rich link → `app.wzrd.tech/approve/<id>?k=…` with a trade renderer.

The resolver, for `trade_order`, in this order: verify decision `pending` and owner; verify preview token (T2) against the decision `ref`; re-verify product SPOT/online (T4); re-check caps against today's ledger (T6); mark `trade_orders.state='submitting'`; call Coinbase create with `client_order_id` (T5); on 2xx → `submitted` and store the Coinbase order id; on unknown → `uncertain` and stop (C23); then the conditional `status='approved'` flip. Deny → `denied`, token discarded. Expiry → a sweep marks `expired` and the card reloads to "Expired — ask again for a fresh preview".

### 5.5 Text fallback on iMessage (new for Air)

Adaam accepts a thread-bound `YES`/`NO`. Air has no text approval parser today. Add one, narrowly: while a `trade_order` is `pending` for this user *and* the inbound arrives within its expiry, a message whose entire trimmed body is `yes|approve` or `no|deny|cancel` resolves it through the same resolver. Anything else falls through as normal chat. Never match inside a longer sentence ("yes but make it $40" is a new request, and T3 refuses it until the pending one is resolved or denied). Logged as `decision.resolved_via='text'`.

---

## 6. Domain model

### 6.1 Postgres (routing + ledger, no holdings)

```sql
-- 0109_trade_miniapp.sql
create table trade_connections (
  user_id           uuid primary key references users(id) on delete cascade,
  provider          text not null default 'coinbase' check (provider in ('coinbase')),
  key_id            text,                        -- CDP key name; not secret
  key_id_hint       text,                        -- last 4 for the UI (C18)
  secret_sealed     bytea,                       -- secretbox(PROVIDER_VAULT_KEY)
  portfolio_uuid    text,                        -- the one Advanced Trade portfolio the key is scoped to
  portfolio_name    text,
  mode              text not null default 'paper' check (mode in ('paper','live')),
  status            text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  per_order_usd_cap numeric(12,2) not null default 250,
  daily_usd_cap     numeric(12,2) not null default 1000,
  last_verified_at  timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table trade_orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  mode              text not null check (mode in ('paper','live')),
  decision_id       uuid references decisions(id),
  client_order_id   uuid not null unique,        -- T5, derived from the preview token
  product_id        text not null,               -- BTC-USD
  side              text not null check (side in ('BUY','SELL')),
  type              text not null check (type in ('market','limit','stop_limit')),
  quote_size numeric, base_size numeric, limit_price numeric, stop_price numeric, stop_direction text,
  preview           jsonb not null,              -- Coinbase preview response, value-bearing, RLS owner-only
  preview_expires_at timestamptz not null,
  state             text not null check (state in
    ('previewed','pending_approval','approved','submitting','submitted','filled','partially_filled',
     'cancelled','denied','expired','rejected','uncertain')),
  coinbase_order_id text, fill jsonb, error_code text,
  notional_usd      numeric(14,2),               -- for caps (T6)
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index on trade_orders (user_id, created_at desc);
create unique index one_pending_per_user on trade_orders (user_id) where state = 'pending_approval'; -- T3

alter table decisions drop constraint decisions_kind_check;
alter table decisions add constraint decisions_kind_check check (kind in (/* existing… */, 'trade_order','trade_cancel','trade_settings'));
```

RLS mirrors `provider_keys`: owner read on everything except `secret_sealed` (service-role only).

### 6.2 Box document (`.hermes/miniapps/trade/`, C4, written under `withStateLease`)

```
watchlist.json   { version:1, items:[{symbol, productId, op, price, state:'armed'|'fired', firedAt?}] }
paper.json       { version:1, cashUsd, positions:{[asset]:{qty, avgCost}}, ledger:[…last 500 fills] }
snapshot.json    { version:1, at, mode, totalUsd, cashUsd, holdings:[{asset, qty, priceUsd, valueUsd}], history:[{at,totalUsd}] (7d, hourly) }
actions.json     append-only, via the existing appendActionLogEntry — the agent's inbox for mini-app taps (MA10)
```

The agent reads `snapshot.json` to answer "how am I doing" without a Coinbase call; the control plane refreshes it on every Portfolio render and after every fill.

### 6.3 Order canonical form and token (`lib/trade/order.ts`, ported)

`tradeOrderSchema` = Adaam's `coinbaseOrderSchema` (decimal strings, product regex, the market/limit/stop size rules in `validateOrder`). `createPreviewToken(order, userId)` / `verifyPreviewToken(token, order, userId)` = Adaam's, with `principalHash = sha256("air-trade-principal\0" + userId)` and signing key `TRADE_PREVIEW_SIGNING_KEY` (new, independent; never the Coinbase secret — Adaam signs with the key secret, which we avoid because ours is per-user and rotatable). `clientOrderIdForPreview(token)` verbatim.

---

## 7. Architecture and trust boundaries

```
 iMessage / web ──/trade──▶ control plane (parse → deterministic | agent turn)
                                  │
 box (Hermes + trade skill) ──Bearer gateway_token──▶ /api/trade/{products,balance,preview,propose,orders,watch}
                                  │                       reads → Coinbase (user key, sealed) ; propose → decisions(pending)
 owner (mini / Needs You / approve link) ──owner session | k-token──▶ resolver ──create/cancel──▶ Coinbase
```

Who holds what:

| Thing | Where it lives | Who can read it |
|---|---|---|
| Coinbase key secret | `trade_connections.secret_sealed`, sealed with `PROVIDER_VAULT_KEY` | Control-plane server code only. Never the box (I1), never the browser (C18). |
| Preview token | Returned to the box tool result and embedded in the decision `ref` | Box (it must echo it in `propose`); harmless alone — it authorizes nothing without an owner resolve. |
| Approval link token | Minted into the iMessage rich link | Owner's phone. 15 min, single decision. |
| `gateway_token` | Box env | Already the box's identity for every other control-plane call. |

**Why the key is not in the box (the biggest departure from Adaam).** Adaam's agent process *is* the trusted server. Air's box is user-owned compute where the agent runs arbitrary code, installs skills from a hub, and can be reached by anything the user connects. A Coinbase key in the box is a key the agent — or a prompt injection in a fetched page — can use to trade without the approval card. Keeping it in the control plane makes T1 a property of the *architecture*, not of the prompt.

### 7.1 Coinbase transport — decision

Adaam spawns `@coinbase/coinbase-cli mcp` as a stdio child inside each Vercel invocation (bounded transport, 8 MB cap, 30 s tool timeout). For Air, **direct REST** to Advanced Trade (`/api/v3/brokerage/{accounts,products,orders,orders/preview,orders/batch_cancel,portfolios}`) with CDP JWT auth (Ed25519, 2-min tokens) in `lib/trade/coinbase.ts`:

- No child process per request, no vendored 1.8 M-token CLI source, cold-start friendly under Fluid compute.
- Only ~9 endpoints are needed; each gets a zod response schema (Adaam's `coinbase-mcp-policy.ts` page cap of 200 and collection normalization carry over as `MAX_PAGE_ITEMS`).
- Public prices (`/api/v3/brokerage/market/products/{id}/ticker`) need no key → paper mode and watchlist work for unconnected users.

Fallback if REST auth proves brittle: the same interface (`TradeVenue`) implemented over the CLI-MCP, identical to Adaam. The interface is the seam; pick REST first.

```ts
export interface TradeVenue {
  getProduct(id): Promise<Product>; listProducts(q): Promise<Product[]>; ticker(id): Promise<Ticker>;
  balances(): Promise<Balance[]>; previewOrder(o: TradeOrder): Promise<Preview>;
  createOrder(o: TradeOrder, clientOrderId: string): Promise<CreateResult>;
  listOrders(scope): Promise<Order[]>; getOrder(id): Promise<Order>; cancelOrders(ids): Promise<CancelResult>;
}
export function coinbaseVenue(conn: TradeConnection): TradeVenue;   // live
export function paperVenue(userId, doc: PaperDoc, prices: PublicPrices): TradeVenue;  // paper, same interface
```

Paper and live share every line of the preview → approve → submit path; only the venue differs. That is what makes paper mode a trustworthy rehearsal and the eval fixture at once.

### 7.2 Control-plane routes (`app/api/trade/`)

| Route | Auth | Effect |
|---|---|---|
| `GET  /api/trade/products?q=` | box or owner | online SPOT products; T4 filter applied here so the agent never sees a non-spot product |
| `GET  /api/trade/balance` | box or owner | available vs hold, per asset; refreshes `snapshot.json` |
| `POST /api/trade/preview` | box or owner | validate → T4 → venue preview → sign token → row `previewed`; returns `{order, preview, authorization:{previewToken, expiresAt}, nextStep}` |
| `POST /api/trade/propose` | box or owner, interactive origin (T7) | verify token → T3 → T6 → row `pending_approval` + `decisions(kind='trade_order')` → returns card/approve URL for the turn to send |
| `POST /api/trade/cancel` | box or owner | `decisions(kind='trade_cancel')` naming one exact open order |
| `GET  /api/trade/orders?scope=` | box or owner | ledger joined with venue status; reconciles `submitted → filled` |
| `POST /api/trade/watch` `DELETE …` | box or owner | leased write to `watchlist.json` |
| `POST /api/decisions` (existing) | owner | + `trade_order`, `trade_cancel`, `trade_settings` arms of the switch |
| `POST /api/cron/trade-watch` | cron secret | ticks watchlists (public prices, no key), fires alerts via the user's line; **never** creates orders (T7) |
| `POST /api/cron/trade-expire` | cron secret | `pending_approval` past `preview_expires_at` → `expired`, decision → `dismissed` |

Box auth is the `boxes.gateway_token` lookup copied from `miniapps/commerce/route.ts`; owner auth is the normal session. One shared `requireTradeCaller(request)` in the lane so the two are never confused.

### 7.3 Box skill (`infra/template/skills/trade/SKILL.md`)

A port of Adaam's `coinbase.md` with tool names replaced by the `curl` recipes the other skills use (`${OPENAI_BASE_URL%/api/gateway/v1}/api/trade/...`, `Authorization: Bearer $OPENAI_API_KEY`). It keeps, verbatim in spirit: the spot-order workflow (resolve → balance → preview → *show* → propose), size rules (market BUY = quote, market SELL = base, limit = base+price), "one order per approval, and stop", proportional sizing against the *just-read* available balance, result handling (preserve ids/amounts exactly; a rejection ends the task; never retry an uncertain write), and the copy rules (T9). New: the agent is told that `propose` *sends the card* and its job then is to write one line — "Sent you the approval for Buy 50 USD of BTC (est. 0.00048 BTC, fee 0.30). Expires in 5 minutes." — and stop.

---

## 8. Owner experience, surface by surface

**iMessage, first run.** `/trade` → card opens Portfolio in paper mode with a two-line welcome ("You're trading on paper with $10,000. Connect Coinbase in Settings when you're ready."). `/trade buy $50 of BTC` → within ~4 s a `trade_order` card: the receipt block + Approve/Deny. Tap Approve → card flips to "Filled · 0.00048 BTC @ 104,120.55" and the thread gets the same line. `/trade portfolio` → text summary, no card.

**iMessage, live.** Identical, plus the `● live` chip and the caps line under the preview ("$50 of your $250 per-order cap · $120 of $1,000 today"). Over cap → the agent gets a structured `cap_exceeded` and says so; the card is never sent.

**Web `/home`.** `/trade` in the composer opens the mini in the dock (the existing Apps-tab flow). Pending approvals also appear in **Needs You** with the same receipt block. The chat shows the same lines as iMessage.

**Failure copy (fixed strings, tested):** expired preview ("That preview expired. Ask again and I'll price it fresh."), pending collision ("You already have an order waiting for approval: Buy 50 USD of BTC. Approve or deny it first."), uncertain ("Coinbase didn't confirm. I have not retried. Check Orders — your order id is …"), not connected in live mode, product offline, below `quote_min_size` (relayed verbatim from Coinbase, then stop).

---

## 9. Verification

- **Unit (colocated Vitest):** `lib/trade/parse.test.ts`, `order.test.ts` (port Adaam's schema cases + token tamper/expiry/principal-mismatch), `paper.test.ts` (fills, avg cost, insufficient funds), `caps.test.ts`, `coinbase.test.ts` against recorded fixtures (no network), `apps/trade*.test.ts` (owner gate, forbidden actions, approve disables after expiry).
- **Resolver:** `api/decisions` tests for `trade_order`: double-approve races to one submit; deny after approve is a no-op; `uncertain` never re-enters `submitting`.
- **Skill acceptance (paper venue = fixture):** port Adaam's four evals as scripted turns against a paper account seeded with 0.0125 BTC: *order approval*, *order denial*, *balance language* (available vs hold), *chained-trade decomposition* (exactly one preview, one proposal; SOL leg never sized). Run under `npm test` with `TRADE_EVAL_FIXTURE=1`.
- **Manual live gate (before flipping `live` on for anyone):** dedicated, minimally funded Coinbase portfolio; one $5 market buy and one cancel via each of the three approve surfaces; one forced-timeout to confirm `uncertain` is terminal (C23).
- Standard: `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build` in `apps/web`; `verify-box.sh` sees the new skill.

---

## 10. Milestones (Devin sessions; external waits called out)

| # | Deliverable | Est. | Notes |
|---|---|---|---|
| **T0** | Parser + both dispatch sites; `trade` module with Portfolio/Trade/Orders/Watch/Settings in **paper mode only**; box document types; `0109` migration (row, kinds, tables); `trade` skill; deterministic `/trade portfolio|orders|watch|help`; paper preview→approve→fill through the real decision resolver | 1 session | Product exists here. No Coinbase key anywhere yet. |
| **T1** | `coinbaseVenue` REST client + JWT; Settings → Connect (sealed store, verify, portfolio pick); live reads (balances, products, orders) in the app and via `/api/trade/*` | 1 session | Needs a CDP Advanced Trade key on a test portfolio (owner action). |
| **T2** | Live orders: `propose` → `trade_order` decision → three approve surfaces → create with `client_order_id`; caps; `trade_expire` cron; text `yes/no` fallback; failure copy; live gate run | 1 session | The four ported evals pass on paper before this starts. |
| **T3** | Limit / stop-limit tickets, `trade_cancel`, reconciliation of `submitted → filled` from fills, receipts in chat, snapshot history + sparkline | 0.5–1 session | |
| **T4** | Watchlist alerts (`trade-watch` cron, public prices, per-line delivery), `trade_settings` decision for caps, alias words, `open-miniapp` skill mention | 0.5 session | |
| Later | Onchain venue (`thirdwebVenue`: USDC↔token swaps on Base from the user's existing wallet, same `TradeVenue`, same approval card); Adaam strategy packs as read-only research lanes; USD/USDC convert + portfolio transfer (Adaam has these; each is one more approval kind) | — | Not v1. |

---

## 11. Open decisions (need the owner)

1. **Per-user BYO Coinbase key (this plan) vs one operator portfolio with allowlisted principals (Adaam).** BYO is the only shape that scales past one owner and keeps Air out of custody. Confirm.
2. **Paper mode default for everyone on day one?** Recommended yes — `/trade` becomes usable for the whole fleet immediately and the live path inherits a rehearsed UX. Alternative: hide `/trade` behind an entitlement until T2.
3. **Default caps** ($250 / order, $1,000 / day) and whether raising them should require the `trade_settings` approval or just a tap in Settings.
4. **Onchain venue priority.** The repo already has thirdweb wallets funded in USDC on Base and CDP keys for x402. If "trade" for your users means tokens more than tickers, T1/T2 could ship `thirdwebVenue` first and Coinbase second — same plan, venues swapped.
5. **Jurisdiction/compliance copy.** T9 covers the "not advice" posture; anything beyond that (region gating, terms acceptance on first `go-live`) is a product call, not an engineering one.
