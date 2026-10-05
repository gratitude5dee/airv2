# tape.md — `/trade` Tape: the one-screen trading surface (spec)

Companion to `docs/trade/plan.md`. That plan builds the trust rails (T1–T9:
preview→approve→venue, spot only, owner-only). This spec rebuilds the *surface*
on top of them — the cognitive layer — and changes none of the rails.

References: Bloxwap (bloxwap.com — self-custodial Hyperliquid perps, "Trade
with your thumb"), Coinbase for Agents (agents.coinbase.com/mcp +
github.com/coinbase/agents — agents trade stocks/crypto/derivatives and buy
market data via x402, inside owner-set limits, behind explicit approvals).

---

## 1. Review — what's wrong with the current UX

The current Trade mini-app is a brokerage ticket wearing mini-app clothing.
Five tabs (Portfolio / Trade / Orders / Watch / Settings); the Trade tab is a
six-field form in Coinbase syntax — product id, side, order type, size in
quote or base units, limit, stop, stop direction.

1. **Instrument-first, not intent-first.** The form asks for `BTC-USD` and a
   size in the venue's units. The user's actual intent is directional: "I
   think this goes up." The gap between intent and ticket fields is where
   consumer trading UX dies.
2. **You trade blind.** There is no price, no chart, and no position state
   anywhere in the app. The first number the user sees is inside the preview
   — *after* committing to a form. The decision happens before the context.
3. **The loop is fragmented across tabs.** Holdings live in Portfolio, the
   decision in Trade, the outcome in Orders. One decision is spread over
   three screens; feedback latency is tab-switching, not market time.
4. **The trust model is buried.** Preview → approve → fill is the
   differentiator (the same contract Coinbase for Agents ships: agent acts
   inside owner limits, explicit approval). But it renders as a dashed card
   inside a form tab — infrastructure, not stage.
5. **Paper mode has no identity.** $10,000 simulated at real prices is a
   demo — the single most valuable thing the app owns — and the UI never
   says so. No welcome, no rehearsal framing, no closure when a round-trip
   ends.
6. **The prompt bar is the only directional shortcut**, and typing "buy $50
   of BTC" there leaves the surface entirely (fires an agent turn).

What Bloxwap gets right, and what it is:

- **Direction is the verb.** UP / DOWN are the only two buttons; instrument
  and size are ambient context. One screen, one decision.
- **Position is spatial.** Break-even, liquidation, and live P&L are drawn
  as anchors on the price line — read like terrain, not arithmetic.
- **Demo-first commitment gradient.** A welcome sheet teaches the whole
  interaction in three verbs; a $1,000 virtual balance removes stakes.
- **Thumb geometry.** Two half-width buttons pinned to the bottom safe area.
- **Closure.** Exit → realized P&L banner → Share Win. The loop ends
  emotionally resolved.

What Coinbase for Agents adds: the agent is the *operator* inside
owner-defined limits; the human supplies intent and approval. The mini-app
should be the cockpit for exactly that — not a terminal the human
operates.

## 2. The mapping — Bloxwap semantics onto spot rails

§0.1 of plan.md is load-bearing: **spot only — no shorts, leverage, margin,
or liquidation.** The tape copies Bloxwap's *interaction*, not its
instrument. Honest mapping:

| Bloxwap        | Tape (spot)                                                        |
|----------------|-------------------------------------------------------------------|
| UP → go long   | UP → **Buy** a market order of the current stake in USD           |
| DOWN → short   | DOWN → **Sell** stake-worth of the held position — disabled with a reason when flat; never shorts |
| Leverage 10×   | Stake chips: $10 · $25 · $100 · ½ cash · max — size is the dial   |
| Break-even     | Dashed line at the position's **average cost basis**               |
| Liquidation    | Omitted. Spot can't be liquidated — we never draw an anchor the venue can't honor |
| LOCK           | **Target** — arms a price watch above entry (existing watch subsystem → iMessage alert); renders as a dotted target line |
| CLOSE          | Sells the full position at market — visible only while holding    |
| P&L chip       | Unrealized P&L: `qty × (price − avgCost)`, ticks with the tape    |
| $1,000 demo    | Paper mode, $10,000 — same loop, real prices, zero stakes         |
| Win banner     | Realized-P&L banner on close-out + a copyable share line          |
| Asset rail     | Market rail: watchlist + held assets + default majors             |
| Welcome modal  | First-run sheet: three verbs + "approvals before money moves"     |

**Two-tap trust loop.** Bloxwap is one tap; air is two — by design:

```
tap UP/DOWN  →  tape_intent: previewTrade + proposeTrade (server-side)
             →  the pending decision IS the review card, anchored on the
                chart: exact order, est fill, fee, cap meter, 5:00 countdown
tap Approve  →  resolveHostedDecision → venue → fill banner
```

The first tap is free, reversible, and expires; the second is the conscious
act that moves money. The preview token never round-trips through the
browser — tighter than the ticket flow. T1–T9 are untouched: intent files a
`pending` decision, only the resolver executes, one pending per user (a
second tap while pending surfaces the existing card), caps enforce
server-side, paper is byte-identical to live.

## 3. The screen

Portrait-first; desktop is the same layout wider, not a different app.

```
┌───────────────────────────────────────────┐
│ BTC-USD $104,231 ▲1.2%        $10,000 paper│  top chips: market · equity+mode
│                                           │
│        · · · · · · · · · · · · · · · · ·  │  canvas: 90 × 1-min candles
│      qty 0.0021    ~~~~~~~~~~ (price)     │  dotted grid, line + area fill
│      avg 104,050   — — — break even — —  │  left rail: position stats
│      P&L +$0.38           ┄┄ target ┄┄    │  when held: cost basis + target
│                          [$104,289] ●     │  right edge: live price pill
│                                           │
│ ┌─ pending card (anchored, when staged) ─┐│
│ │ Buy $25 BTC · est 0.00024 · fee $0.15  ││  ← the review IS the card
│ │ $25 of $250/order · expires 4:52       ││
│ │            [Deny] [Approve — place it] ││
│ └────────────────────────────────────────┘│
│ [ $10  $25  $100  ½  max ]   stake chips  │
│ ┌───────────────┐ ┌───────────────┐      │
│ │  DOWN (sell)  │ │   UP (buy)    │      │  thumb zone, bottom safe area
│ └───────────────┘ └───────────────┘      │
└───────────────────────────────────────────┘
```

States:

- **flat** — UP enabled; DOWN shows "nothing to sell". Holding → DOWN sells
  stake-worth, CLOSE pill appears next to the P&L chip (sell-all).
- **pending approval** — buttons collapse into the card; expiry countdown
  runs; Deny dismisses, Approve executes (resolve under owner session).
- **filled** — banner: `Bought 0.00024 BTC @ 104,212` / on close-out
  `+$0.74 USD realized` + a share line (copies text; no social integration).
- **first run** — welcome sheet: *Trade with your thumb. UP buys, DOWN
  sells. Every order previews itself and waits for your Approve — nothing
  moves money without it. You're on paper with $10,000.* One button:
  *Let me try it.* Server-rendered flag; dismissal POSTs `tape_seen`.
- **paper** — mode chip always visible (`$10,000 paper`); live shows
  `● live · <portfolio>` and the caps meter under the pending card.
- **lite (`via=card`)** — the Messages webview has a GPU budget and no JS
  guarantee: tape renders the static fallback — last price, position line,
  and the classic ticket form (progressive enhancement, no bundle).

Tabs become: **Tape** (default) · Portfolio · Orders · Watch · Settings.
The old six-field ticket survives as an *Advanced order* `<details>` inside
Tape — limit and stop-limit stay reachable without a sixth tab.

## 4. Engineering

- `apps/web/lib/miniapps/apps/trade.tsx` — new `tape` tab (default), mount
  node `<div id="trade-tape" data-payload="{…}">`, script
  `/creator-os/trade-tape.js`, CSP widens `connect-src 'self'` (script-src
  self is already auto-added by `shellHtml`). JSON actions in `action()`:
  - `tape_state {product}` → price, candles, mode, equity, position
    {qty, avgCost, valueUsd, pnlUsd}, pending decision, caps-usage
  - `tape_intent {product, side, stakeUsd}` → `previewTrade` +
    `proposeTrade` → `{decisionId, summary, est, expiresAt}`
  - `tape_resolve {decisionId, choice}` → `resolveHostedDecision` →
    `{state, detail, realizedPnlUsd?}`
  - `tape_close {product}` → intent for SELL of the full held qty
  - `tape_target {product, price}` → `addWatch` → `{ok}` (the LOCK mapping)
  - `tape_seen` → clear first-run flag
- `lib/miniapps/client/trade-tape.tsx` — the bundle: canvas renderer
  (dotted grid, polyline + area fill, dashed anchors, right-edge price
  pill), state poll every 2.5 s (`POST ?tab=tape`, `action=tape_state`),
  buttons, stake chips, cards, banner, welcome sheet. No dependencies, no
  localStorage (C17) — state lives server-side.
- `lib/trade/coinbase.ts` — add `coinbasePublicCandles(productId,
  granularity="ONE_MINUTE", limit=90)` (`/market/products/{id}/candles`,
  unauthenticated); `lib/trade/service.ts` — `tapeState()` aggregation +
  `positionCostBasis()` (paper: `positions[asset].avgCost`; live: weighted
  avg of the user's `trade_orders` buy fills for that product) and realized
  P&L for the close banner.
- `scripts/build-trade-tape.mjs` + `prebuild` wiring (esbuild, iife — the
  image-editor pattern).
- Tests: colocated `trade-tape.test.ts` — action contract (bad inputs →
  4xx; `tape_intent` while pending → 409 shape; resolve denies strangers —
  owner gate first), payload shape, `costBasis` math.
- `docs/trade/plan.md` — add one line under §3 noting the tape supersedes
  "charts beyond a sparkline" as a non-goal.

## 5. Explicit non-goals (this build)

- Shorts, leverage, perps, liquidation — spot only, unchanged (§0.1).
- A real take-profit order: Target is a watch *alert* in v1; a resting
  limit sell rides the existing limit ticket until a later build.
- Coinbase for Agents interop: our box skill stays as-is; a follow-on can
  map its skill taxonomy (market-data / portfolios / trading / watch) and
  consider the hosted MCP or x402 market-data purchases.
- Social win cards; the share line is copy-to-clipboard.
- Anything non-owner: tape obeys the same `access='single'` gate.

## 6. Acceptance

- Paper user: open `/trade` → welcome sheet → tap UP → pending card →
  Approve → fill banner → position rail + break-even line → DOWN/close →
  realized-P&L banner. Two taps to a fill; zero tabs touched.
- `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`
  clean in `apps/web`; bundle < ~40 KB minified.
