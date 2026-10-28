# R-CF-03 — iMessage outbound transport

> Part of the [Cloudflare migration spec](../cloudflare-migration.md). Section references (§0–§7) and other `R-CF-NN` items are defined there; the architecture contract is §2. Ship this item as one PR titled `R-CF-03: …`.

**Why.** Every outbound iMessage action goes through `SpectrumSender` (`apps/web/lib/spectrum/sender.ts:24-119`). Its only live implementation calls `Spectrum()` once per sender (`sender.ts:196-226`), and the spectrum-ts 12.10.1 iMessage provider behind that call always uses `createGrpcClient` from `@photon-ai/advanced-imessage/grpc`. The tapback fast path builds the same gRPC client directly (`lib/spectrum/fast-reaction.ts:110-119`, hosts at `:15` and `:108`). In workerd, `node:http2` is a stub: these modules load, but every RPC throws. So on Cloudflare today we cannot send any tapback, bubble, card, attachment or Find My request.

Photon's hosted plane speaks only gRPC ("There is no public HTTP send-message endpoint", `ARCHITECTURE.md:781`). The SDK's fetch client needs the address of an `imessage-server-v2-http` middleware (advanced-imessage 2.2.0 `README.md:7,112`), and Photon has not published one. So the primary transport is a Node 22 relay Container in `air-sidecar` (option (c), `ARCHITECTURE.md:787`). Photon HTTP is a later, gated transport: it ships dark in this item and is switched on only once Photon confirms an endpoint.

Sends are also not idempotent today:
- Only `requestLocation` takes a `clientMessageId` (`sender.ts:104-109`).
- The SDK's `autoIdempotency` key is a fresh UUID for every JS call (`dist/chunk-K6EWD2JS.js:1265`).
- Only `clientMessageId` dedupes across retries (`README.md:468-470`).

Without keys, the durable retries that R-CF-04 adds would send duplicate bubbles.

**Deltas.**

*Transport layer: new modules in `apps/web/lib/imessage/`.* That directory already holds the history-archive modules (`archive*.ts`, `ingest.ts`, `uploadBody.ts`). They are unrelated: do not rename or touch them.

- `transport.ts` NEW. This is the contract every non-spectrum transport implements:
  ```ts
  export type TransportName = "spectrum" | "relay" | "http";
  /** Replayable: a failed-over or retried upload re-opens the body (a stream can be read once). */
  export type AttachmentBody = Uint8Array | { size: number; open(): Promise<ReadableStream<Uint8Array>> };
  export type ReactionInput =
    | { kind: "love" | "like" | "dislike" | "laugh" | "emphasize" | "question" }
    | { kind: "emoji"; emoji: string };
  export interface ImessageTransport {
    readonly name: "relay" | "http";
    setTyping(phone: string, chat: string, on: boolean): Promise<void>;
    markRead(phone: string, chat: string): Promise<void>;
    sendText(phone: string, chat: string, text: string,
      o?: { replyTo?: { guid: string; partIndex?: number }; linkPreview?: boolean; clientMessageId?: string }): Promise<{ guid?: string }>;
    edit(phone: string, chat: string, guid: string, text: string, o?: { partIndex?: number }): Promise<void>;
    setReaction(phone: string, chat: string, target: { guid: string; partIndex?: number }, r: ReactionInput,
      o?: { clientMessageId?: string; timeoutMs?: number }): Promise<void>;
    sendAttachment(phone: string, chat: string, body: AttachmentBody,
      o: { name: string; mimeType: string; clientMessageId?: string }): Promise<{ guid?: string }>;
    downloadAttachment(phone: string, guid: string, o?: { maxBytes?: number }):
      Promise<{ data: Uint8Array; name: string; mimeType: string } | undefined>;
    sendMiniApp(phone: string, chat: string, m: MiniAppMessage, o?: { clientMessageId?: string }):
      Promise<{ guid?: string; session?: MiniAppCardSession }>;
    updateMiniApp(phone: string, session: MiniAppCardSession, m: MiniAppMessage, o?: { clientMessageId?: string }):
      Promise<{ session?: MiniAppCardSession }>;
    requestLocation(phone: string, chat: string, address: string, clientMessageId: string): Promise<LocationRequestReceipt>;
    getSharedLocation(phone: string, address: string): Promise<SharedFriendLocation | undefined>;
  }
  ```
  The module also exports:
  - `TransportError {code, retryable, sent}`. `code` is either an SDK `ErrorCode` (`@photon-ai/advanced-imessage@2.2.0 dist/groups-BYjWoH6H.d.ts:7-39`, which already includes `timeout`) or one of `draining | not_ready | too_large | inflight`.
  - `TAPBACK_KIND`, which maps the six aliases in `lib/spectrum/tapbacks.ts:8-15` to `love | like | dislike | laugh | emphasize | question` (the SDK shape is at `groups-BYjWoH6H.d.ts:325-330`). Any other emoji becomes `{kind:"emoji", emoji}`.
  - `imessageKey(...parts: (string | number)[])`, which returns `"a1" + hex(sha256(parts.join("\u001f"))).slice(0, 40)`. This gives a fixed length and charset until Photon answers Q4. It is the only way to build a key (§2.5 C15): callers pass parts, for example `imessageKey("creative", jobId, "attachment")`, and never format a key string themselves.
  - `selectTransport()`. It returns `env.imessageTransport()` when set. Otherwise it returns `relay` when `onWorkerd()` and `spectrum` elsewhere (`lib/runtime/platform.ts`, §2.5 C2). An unusable choice logs `log.error` and falls back to the platform default. The unusable choices are `spectrum` on workerd, `relay` without a `SIDECAR` binding in `cfEnv()` (Vercel), and `http` without `PHOTON_IMESSAGE_HTTP_ADDRESS`.
- `relay.ts` NEW: `createRelayTransport(sidecar?: Fetcher)`.
  - Resolve the fetcher inside each call (`cfEnv()?.SIDECAR` from `lib/runtime/platform.ts` unless one is injected), never at module scope. Do not call `getCloudflareContext()` directly (§2.5 C2): `cfEnv()` also works inside a DO, a Workflow `run()`, `queue()` and `scheduled()`, which is where R-CF-04, R-CF-08 and R-CF-11 send from.
  - Base URL is `https://sidecar/imessage/v1`. Send these headers:
    - `x-relay-key: <sha256(chat) first 16 hex>` for instance affinity. The raw chat guid embeds a phone number (repo constraint C4).
    - `x-idempotent: 1` when the op carries a `clientMessageId` or is naturally idempotent (typing, read, reaction, edit, GET).
  - Bodies are JSON, except attachments, which are sent as the raw request body. For a stream body, call `open()` and pipe it through `new FixedLengthStream(size)` so the container receives `content-length`.
  - Timeouts use `AbortSignal.timeout`: reaction 3 s, other unary calls 10 s, attachment upload/download 120 s, ready 2 s.
  - `downloadAttachment` enforces `maxBytes` from `content-length` first, then with a counting reader.
  - No other retries. The single exception is a 503 `draining | not_ready` with `x-relay-sent: 0` on `POST /attachments`: retry once with `x-relay-instance: <next>` and a fresh `open()`, because the router cannot replay a stream body. Callers retry everything else with the same key.
- `http.ts` NEW. Later, gated: it ships dark in this PR and stays off until Photon confirms.
  - Use `createHttpClient` from `"@photon-ai/advanced-imessage/http"`. Use the subpath: the package root also re-exports the gRPC chunk, which lazily imports nice-grpc.
  - Options: `{address: env.photonImessageHttpAddress(), token: async () => (await tokens()).forPhone(phone), server: <instanceId>, retry: {maxAttempts: 2}, timeout: 10_000, autoIdempotency: false}`. Set `server` only for dedicated lines; it is sent as `x-photon-server` (`dist/chunk-K6EWD2JS.js:1262`).
  - Hand-roll the two byte routes: `POST /v1/attachments:upload?fileName=` with a streamed body (`chunk-K6EWD2JS.js:1442`), and `GET /v1/attachments/{guid}/data` (`:1522`). The SDK's `upload` needs a whole `Uint8Array` (`groups-BYjWoH6H.d.ts:207-217`), and its single `AbortSignal.timeout` also covers the body transfer (`chunk-K6EWD2JS.js:1252`).
  - Cache one client per instance at module scope.
- `tokens.ts` NEW. Used by `http.ts` only; the relay mints its own tokens inside the container.
  - Port `fast-reaction.ts:19-61`: per-isolate cache, single-flight, 30 s refresh skew, `dedicatedInstanceForPhone`.
  - Use plain `fetch`: `POST ${env.spectrumApiBase()}/projects/{id}/imessage/tokens` (`lib/env.ts:443-444`), Basic `id:secret`, and unwrap the `{succeed, data}` envelope. This matches `@spectrum-ts/core@12.10.1 dist/index.js:2900-2923` (`cloud.issueImessageTokens`).
  - Never persist or log a token (`fast-reaction.ts:8-9`).
- `sendLedger.ts` NEW: persisted send results, keyed by `clientMessageId`.
  - `begin(key, {spaceId, kind})` returns `new`, `sent {guid?, cardSession?, editCount, shownChars}` or `inflight`. A `pending` row updated less than 60 s ago counts as in flight. An older `pending` row is taken over: increment `attempts` and resend with the same key.
  - `done(key, result)`, `failed(key, err)`, and `bumpEdits(key, n, guid, shownChars)`.
  - The default implementation is `PostgresSendLedger`.
  - Ledger read/write errors fail open: log `log.warn` and send anyway with the key, since Photon still dedupes on `clientMessageId`.
  - Only message-creating ops use the ledger: text, reply, stream, attachment, rich link, app, location. Typing, read, reaction and edit are naturally idempotent and skip it, which keeps the ledger off the 1 s tapback path.
- `transportSender.ts` NEW: `createTransportSender(transport, ledger): SpectrumSender`. Method mapping:
  - `startTyping` → `setTyping(on)`.
  - `markRead` → `markRead(chat)`. This drops today's `getMessage` plus direction check (`sender.ts:245-250`); iMessage marks the whole chat read anyway.
  - `sendText` → `sendText`.
  - `sendReply` → `sendText({replyTo})`. On `messageNotFound` return `false`, which keeps the contract at `sender.ts:254-260` (callers fall back to `sendText`).
  - `react` → `setReaction(TAPBACK_KIND)`, with the `p:N/guid` parse from `fast-reaction.ts:63-73`. On `messageNotFound` return `false`.
  - `sendRichLink` → `sendText(url, {linkPreview: true})`.
  - `sendApp` → `sendMiniApp`. Card identity comes from `env.imessageMiniAppExtension()` (`lib/env.ts:566`); build the layout as in `sender.ts:136-162`. Returns `SentApp`.
  - `editApp` → one `updateMiniApp(session)` call. This removes the up-to-2 `getMessage` calls at `sender.ts:282-307`. `messageNotFound` and `preconditionFailed` return `undefined` (stale); `chatNotFound` and `operationNotSupported` throw.
  - `getAttachment` → `downloadAttachment`, with per-caller `maxBytes` (below; default 16 MiB). Wrap the result without copying, as `Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength)`, so `flush.ts:556` keeps compiling.
  - `requestLocation` and `getSharedLocation` → direct calls. This path does not use the `advancedClientForLine` internals hack (`sender.ts:170-186`).
  - `close` is a no-op.
  - `streamText(spaceId, phone, stream, opts)`:
    1. Drain `stream` until it ends or 300 ms pass with no new chunk.
    2. If it ended, send one keyed `sendText`. That is the only production shape today: the reply is fully buffered before any send (`flush.ts:1825-1849`), and `bubbles.ts:43-65` feeds it as 1-2 chunks.
    3. If it did not end, port the spectrum-ts throttle (`@spectrum-ts/imessage@12.10.1 dist/index.js:2645-2691`): `sendText(first)`, at most 4 interim `edit`s at gaps of at least 1, 2, 4 and 8 s, then one final `edit` with the full text. That stays within Apple's 5-edit cap.
    4. Call `ledger.bumpEdits` before each edit. A retry with the same key resumes. If `editCount < 5`, it makes one final edit. Otherwise it sends `text.slice(shownChars)` as a new bubble keyed `imessageKey(key, "tail")`.

*Sender interface: `apps/web/lib/spectrum/sender.ts`.*
- Every sending method gains an optional key. Nothing else about the call shape changes:
  ```ts
  export interface SendOpts { clientMessageId?: string }
  export interface SentApp { id?: string; miniAppCardSession?: MiniAppCardSession } // replaces spectrum-ts Message (:8, :75)
  sendText(spaceId, phone, body, opts?: SendOpts): Promise<void>;
  sendReply(spaceId, phone, messageId, body, opts?: SendOpts): Promise<boolean>;
  react(spaceId, phone, messageId, emoji, opts?: SendOpts): Promise<boolean>;
  streamText(spaceId, phone, stream, opts?: SendOpts): Promise<void>;
  sendApp(spaceId, phone, url, layout?, opts?: SendOpts): Promise<SentApp | undefined>;
  editApp(spaceId, phone, session, url, layout?, opts?: SendOpts): Promise<MiniAppCardSession | undefined>;
  sendAttachment(spaceId, phone, data: Buffer | AttachmentBody, options: { name; mimeType; clientMessageId? }): Promise<void>; // :85-90
  sendRichLink(spaceId, phone, url, opts?: SendOpts): Promise<void>;
  getAttachment(attachmentId, phone, opts?: { maxBytes?: number }): Promise<...>; // :94-97, optional arg only
  // unchanged: startTyping, markRead, requestLocation (already keyed, :104-109), getSharedLocation, close
  ```
  > Note for owner: the contract says `SpectrumSender` "keeps its shape", but two types still have to change. `sendApp` must return a local `SentApp`, because the relay and HTTP paths cannot produce a spectrum-ts `Message`. `sendAttachment` widens from `Buffer` to `Buffer | AttachmentBody` for R2 streaming. Both changes are source-compatible: `persistCardSession` only reads `miniAppCardSession` (`cards.ts:519-548`), and `Buffer` is a `Uint8Array`.
- `createSpectrumSender(site?, deps?: {transport?: ImessageTransport; ledger?: SendLedger})`:
  - Recording seams run first (`:199-202`, unchanged).
  - Then call `selectTransport()`. For `"spectrum"`, keep the existing body (`:203-331`) and wrap keyed sends in the ledger. spectrum-ts content builders take no key; only `requestLocation` forwards one (`:308-312`). For any other transport, return `createTransportSender(...)`.
  - Never `import("spectrum-ts")` on the relay or HTTP path.
  - It needs no OpenNext request context: `selectTransport()` and `relay.ts` read `cfEnv()` (§2.5 C2), and every airv2-app entrypoint has already run `applyEnv(env)` (§2.5 C3). R-CF-04's `ConversationDO`, R-CF-08's `CreativeJob` and R-CF-11's schedule delivery call `createSpectrumSender()` as is. There is no separate factory for those contexts.
- `lib/spectrum/recording.ts:26-80, 103-…`: accept and record `clientMessageId`. Record `bytes` as `data instanceof Uint8Array ? data.byteLength : data.size`.
- `getAttachment` caps per caller:
  - `flush.ts:547` materialize: 16 MiB. An over-cap file gets the "too large" marker (R-CF-04 `start`).
  - `drawCommand.ts:97`: `MAX_DRAW_IMPORT_BYTES`, 10 MiB (`lib/miniapps/draw.ts:58`).
  - `freezeCommand.ts:87`: `MAX_FREEZE_UPLOAD_BYTES`, 12 MiB (`lib/miniapps/freeze.ts:59`).
  - `creative/imessage.ts:121`: 16 MiB until R-CF-09 streams inputs through R2 (verify the bound with R-CF-09).
  - The spectrum transport ignores `maxBytes` (Vercel behavior is unchanged).
- Every method and every caller. Constructors:
  - `flush.ts:1060`
  - `routing/imessage.ts:79`
  - `cards.ts:244,404,619`
  - `muse/notify.ts:113,133`
  - `calendar/sweep.ts:188`
  - `trade/watch.ts:170`
  - `trade/imessage.ts:86`
  - `provisioning/welcome.ts:36`
  - `location/resolve.ts:165`
  - `apps/onboarding.tsx:4445`
  - `apps/draw.tsx:296`
  - `apps/freeze.tsx:515`
  - `api/create/plan/deliver/route.ts:42`
  - `api/create/icon/route.ts:126`
  - `api/internal/create/notify/route.ts:76`
  - fast reaction at `api/inbound/imessage/route.ts:134`

  Call sites by method:

  | Method | Ledger | Call sites (`apps/web/`) |
  |---|---|---|
  | `startTyping` | no | `app/api/inbound/imessage/route.ts:475` |
  | `markRead` | no | `route.ts:472` |
  | `sendText` | yes | `route.ts:412`; `api/internal/create/notify/route.ts:78`; `lib/identity/twinCommand.ts:174,182,190,200`; `lib/orchestrator/bubbles.ts:94,101`; `lib/orchestrator/flush.ts:762,793,907,922,935,1150,1207,1262,1318,1361,1445,1464,1639,1922,1959`; `lib/routing/imessage.ts:66,183`; `lib/muse/notify.ts:115,135`; `lib/miniapps/cards.ts:430`; `lib/miniapps/imessageCommand.ts:103,124,165`; `lib/miniapps/drawCommand.ts:89,147,167,174`; `lib/miniapps/freezeCommand.ts:77,129,145,152`; `lib/miniapps/apps/onboarding.tsx:4449`; `lib/location/lane.ts:86,151`; `lib/location/resolve.ts:175,185,202,236`; `lib/creative/imessage.ts:111,157,167,241,270,278`; `lib/trade/watch.ts:177`; `lib/trade/imessage.ts:92`; `lib/create/intake.ts:694`; `lib/create/icon.ts:343`; `lib/create/plan.ts:135`; `lib/provisioning/welcome.ts:38`; `lib/calendar/sweep.ts:190` |
  | `sendReply` | yes | `route.ts:403`; `flush.ts:1914`; `routing/imessage.ts:64` |
  | `react` | no | `flush.ts:1908`; `routing/imessage.ts:138` (fallback after the fast path at `:127`) |
  | `streamText` | yes | `bubbles.ts:65` |
  | `sendApp` | yes | `cards.ts:246,409`; `imessageCommand.ts:144`; `drawCommand.ts:131`; `freezeCommand.ts:113` |
  | `editApp` | no | `cards.ts:629` |
  | `sendAttachment` | yes | `orchestrator/outbound.ts:181`; `apps/draw.tsx:298`; `apps/freeze.tsx:517`; `creative/imessage.ts:254`; `create/icon.ts:339`; `create/plan.ts:124` |
  | `sendRichLink` | yes | `imessageCommand.ts:163`; `drawCommand.ts:145`; `freezeCommand.ts:127`; `creative/imessage.ts:266`; `trade/imessage.ts:89` |
  | `getAttachment` | no | `flush.ts:547`; `drawCommand.ts:97`; `freezeCommand.ts:87`; `creative/imessage.ts:121` |
  | `requestLocation` | yes | `location/lane.ts:136` (already passes `request.id`) |
  | `getSharedLocation` | no | `location/resolve.ts:190` |

- Key scheme. Every key is `imessageKey(...parts)` (§2.5 C15). The parts are listed here as tuples; callers pass them as arguments and never join or format them.
  - Webhook: `("ack", messageId, "react")`, `("ack", messageId, "first")` (`routing/imessage.ts:183`), and `("line", messageId, "reply")` (`routing/imessage.ts:53-70`, `route.ts:401-414`).
  - Turn: `("turn", spaceId, chainStartedAt, ...slot)`. Slots:
    - `"b0"` … `"b4"` (bubbles; `streamBubbles(..., keyParts?)` derives them at `bubbles.ts:65,94,101`)
    - `"tapback"`, `"tapback-reply"`, `"tapback-text"`
    - `("file", i)` (`deliverSendFiles(..., keyParts?)`)
    - `("card", kind, resourceId)`
    - `"owner-only"`, `"holding"`, `"bridge"`, `"retry-notice"`, `"exhausted"`, `"progress-two"`
    - `("lane", name, n)`

    The lane modules (`twinCommand`, `imessageCommand`, `drawCommand`, `freezeCommand`, `creative/imessage`, `location/lane`, `trade/imessage`, `create/intake`) accept an optional `keyParts: (string | number)[]` on their job argument and append their slot: `imessageKey(...keyParts, "lane", name, n)`.
  - Out-of-turn sends:
    - location: `("loc", request.id, revision, outcome)`
    - calendar: `("cal", schedule.id, dueAt)`. `dueAt` is the pre-claim `schedule.next_run_at` (ISO string) that `claimSchedule` compares against (`calendar/sweep.ts:135`, `p_expected_next_run_at`). The claimed row already carries the advanced `next_run_at`, so `sweepSchedules` (`:401-407`) passes `dueAt` through `runSchedule` to `deliverImessage` (`:177-199`, called at `:318`). R-CF-11's schedule delivery uses the same parts.
    - trade watch: `("trade-watch", userId, item.symbol, item.op, item.price, item.firedAt)`. `firedAt` is set at the armed → firing transition (`trade/watch.ts:145`) and persisted before any send (`:153-161`), so every delivery retry of one cross reuses it. `fired` is terminal, and a new watch on the same symbol, op and price gets a new `firedAt`, so it gets a new key.
    - muse: `("muse", <muse_event id>)` (verify)
    - welcome: `("welcome", userId, boxId)` (verify)
    - create notify: `("create", job.id, outcome)`
    - plan: `("create-plan", userId, appname, path)`
    - icon: `("create-icon", slug, sha256(bytes))`
    - creative delivery: `("creative", jobId, "attachment" | "rich" | "url" | "caption")`. R-CF-08's Workflow path uses the same parts, so a key matches across the inline (Vercel) and Workflow paths.
    - mini-app attachments (`draw.tsx:298`, `freeze.tsx:517`): `("mini", app, jobId)` (verify the ids)
    - checkout card: `("card", "checkout", handoff.id, status)`
  - Once R-CF-04 lands, R-CF-08's iMessage continuation and R-CF-11's schedule delivery send through `ConversationDO.deliver(parts, { key })` (§2.5 C8) with these same keys, so their bubbles stay ordered with the chat's turn bubbles.
  - Web-initiated sends that have no durable id stay unkeyed: each request is a new intent.

*Fast reaction: `lib/spectrum/fast-reaction.ts`.*
- In `createFastReactionSender(phone)` (`:88-136`), keep the recording seams first (`:91-95`).
- Then, when `selectTransport() !== "spectrum"`, return:
  ```ts
  {
    react: (s, m, e) => transport.setReaction(phone, s, reactionTarget(m), {kind: "emoji", emoji: e},
      {clientMessageId: imessageKey("ack", m, "react"), timeoutMs: 3000}),
    close: noop,
  }
  ```
  That is one call, with no in-app token mint or client build.
- Keep the gRPC branch (`:96-135`) for Vercel.
- Add `"relay-direct" | "http-direct"` to the transport label union at `lib/routing/imessage.ts:120`.

*Cards: `lib/miniapps/cards.ts`.*
- Replace `import type { Message } from "spectrum-ts"` (`:30`) with `SentApp`.
- `isUnsupportedError` (`:44-47`) also returns true when `TransportError.code === "operationNotSupported"`. Keep the lazy spectrum-ts check for Vercel. It feeds both the checkout fallback (`:425`) and the unsupported-means-stale branch of `updateMiniAppCard` (`:671-683`).
- Checkout (`:424-427`) falls back to the browser link only on `operationNotSupported`. `chatNotFound` stays a failure.
- A stale result also comes from `editApp` returning `undefined` (`:640-653`).

*Attachments.*
- `sendAttachment` sends the bytes as the raw request body: no base64 and no JSON envelope.
- Callers that hold an R2 object pass `{size: obj.size, open: async () => (await env.MEDIA.get(key))!.body}`. This applies to creative assets once R-CF-09 moves them; today `creative/imessage.ts:246-254` still buffers the Supabase download into a `Buffer`.
- Caps:
  - Send-files stay at 6 MiB (`outbound.ts:29`).
  - Relay upload cap `RELAY_MAX_UPLOAD_BYTES` is 50 MiB. Over the cap returns 413 `too_large`, which hits the existing rich-link/URL fallback (`creative/imessage.ts:262-273`).
  - Inbound downloads use the per-caller caps above.

*Relay: `infra/workers/sidecar/`, a NEW package.*
- Layout follows `infra/workers/muse/`: `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `worker-configuration.d.ts` (`wrangler types`), `src/`, `test/`, plus `relay/`. Muse uses `wrangler.toml`; use `wrangler.jsonc` here, as `apps/web/wrangler.jsonc` does.
- `wrangler.jsonc`:
  ```jsonc
  { "name": "air-sidecar", "main": "src/index.ts", "account_id": "e8f42c0430906e1515a2af01d5c1d2d1",
    "compatibility_date": "2026-10-12", "compatibility_flags": ["nodejs_compat"],
    "workers_dev": false, "preview_urls": false,                     // no ingress: service binding only
    "containers": [{ "class_name": "ImessageRelay", "scheduling_policy": "durable_object",   // beta (CF changelog 2026-09-30)
                     "images": { "relay": { "dockerfile": "./relay/Dockerfile" } } }],
    "durable_objects": { "bindings": [{ "name": "IMESSAGE_RELAY", "class_name": "ImessageRelay" }] },
    "migrations": [{ "tag": "v1-imessage-relay", "new_sqlite_classes": ["ImessageRelay"] }],  // §2.5 C8: append-only on this worker
    "vars": { "RELAY_INSTANCES": "2", "RELAY_MAX_UPLOAD_BYTES": "52428800" },
    "triggers": { "crons": ["* * * * *"] }, "observability": { "enabled": true } }
  ```
  - With the `durable_object` policy, the instance size is chosen in `start()`. Wrangler takes no `image`, `instance_type` or `max_instances` for it (developers.cloudflare.com/containers/configuration/scheduling-policy/).
  - The instance count is the fixed name set `relay-0` and `relay-1`, both always warm (`RELAY_INSTANCES` = 2; §2.5 C14). It is not a config cap: no `max_instances` applies to this class, and §3 and R-CF-15 cost and alert on exactly these two instances. Changing `RELAY_INSTANCES` remaps chats to instances, so treat it as fixed.
  - Migration tags are append-only in merge order (§2.5 C8). Later classes on this Worker (R-CF-09 `MediaWorker`, R-CF-05's optional `TenkiRelay`) take the next `vN-<name>`.
  - Secrets are `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET`, from the `## secret @air-sidecar` block (`apps/web/env.example.md:495-500`).
    - They are plain per-name Worker secrets, not env packs, so the sidecar reads `env` directly. `applyEnv` (§2.5 C3) belongs to airv2-app's entrypoints and is not imported here.
    - The owner pushes them with `npm run cf:env -- push --worker air-sidecar` (R-CF-01; owner-only, §2.5 C22). `push --worker` refuses a Worker that has no deployment, so this runs after the first deploy (see *Deploy order* below).
  - Optional overrides `SPECTRUM_API_BASE` and `SPECTRUM_IMESSAGE_ADDRESS` go into `vars` only when needed.
  - Route namespaces in this Worker: `/imessage/v1/*` (this item), `/media/v1/*` (R-CF-09 `MediaWorker`) and `/tenki/v1/*` (R-CF-05's optional `TenkiRelay`). The Worker strips the first segment, so each container serves `/v1/*`. All three are binding-only (§2.5 C15).
- `src/index.ts`, `fetch` handler:
  - `/imessage/v1/*` → strip the `/imessage` prefix (container path `/v1/*`), then `env.IMESSAGE_RELAY.getByName("relay-" + (x-relay-instance ?? fnv1a(x-relay-key) % RELAY_INSTANCES)).fetch(req)`.
  - Buffer JSON bodies (≤ 64 KiB, `await req.arrayBuffer()`) so they can be replayed.
  - Fail over to the next instance only in two cases: the response is 503 with `x-relay-sent: 0`; or the stub throws before any response and the request carries `x-idempotent: 1`.
  - Never fail over `POST /attachments` (stream body; `relay.ts` retries it).
  - Every other status passes through unchanged.
  - Log one `imessage.send` event per relayed op, `{op, outcome, duration_ms}`, using R-CF-15's canonical event names (§2.5 C16).
  - `/ops/status` returns `status()` for every instance. `/ops/drain/:i` calls `drain()` on that instance. These exist for the admin probe; airv2-app cannot call another Worker's DO RPC directly.
  - Auth: no route, no custom domain and no workers.dev, so the `SIDECAR` service binding from airv2-app is the only way in (developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/). There is no header auth (§2.5 C15).
- `src/index.ts`, `scheduled` handler:
  - This cron is the sidecar's own housekeeping. It is not gated by `platform_settings.cron_host`, which governs only airv2-app's crons (§2.5 C13).
  - Call RPC `warm()` on every instance; it re-arms the alarm if a deploy dropped it.
  - Then roll the image. `durable_object`-policy instances do not take part in rollouts, so a new `ctx.container.images.relay` ref would never reach a running container on its own. Upgrade at most one instance per tick, and only while every other instance reports ready: if `status().imageRef !== status().currentImageRef`, call `upgrade()`.
- `src/relay.ts`: `ImessageRelay extends DurableObject`, using the Durable Object Container API (developers.cloudflare.com/containers/api/durable-object-container/).
  - Constructor: if `ctx.container.running`, call `ctx.blockConcurrencyWhile(() => ctx.container.setInactivityTimeout(21_600_000))`. The timeout does not survive a DO restart, and 6 h is the maximum.
  - `ensureRunning()`:
    - Call `ctx.container.start({image: ctx.container.images.relay, instance: "lite", enableInternet: true, env: {…secrets, RELAY_MAX_UPLOAD_BYTES}})`, store `imageRef` and `startedAt` in DO storage, then `setInactivityTimeout`.
    - Poll `/v1/ready` every 200 ms for up to 15 s.
    - Concurrent callers share one readiness promise.
  - `fetch`: `ensureRunning()`, then `ctx.container.getTcpPort(8080).fetch(...)`, rewriting the host to `container`.
  - `alarm()` is the keep-warm, every 30 s:
    - `ensureRunning()`, then `GET /v1/ready` with a 2 s timeout.
    - After 3 consecutive failures, `destroy()` the container and start it again.
    - Log R-CF-15's relay-health event `{instance, ready, inflight}` (§2.5 C16).
    - Always re-arm. Never throw: platform alarm retries stop after 6 (developers.cloudflare.com/durable-objects/api/base/).
  - RPC `status()` returns `{ready, imageRef, currentImageRef: ctx.container.images.relay, startedAt}`.
  - RPC `drain()` calls `ctx.container.signal(15)` (SIGTERM; `signal` takes a number).
  - RPC `upgrade()`: `drain()`, wait for `monitor()` up to 30 s, `destroy()`, then `ensureRunning()`.
  - On the first `get`, pass a `locationHint` near Photon's region (verify the `getByName` options; Photon Q8).
- `relay/Dockerfile`: `node:22-slim`, non-root, `npm ci --omit=dev`, `EXPOSE 8080`, `CMD ["node","server.mjs"]`.
- `relay/package.json` plus `relay/package-lock.json`, pinned to the exact app lockfile versions: `@photon-ai/advanced-imessage` 2.2.0, `@grpc/grpc-js` 1.14.5, `nice-grpc` 2.1.17, `nice-grpc-common` 2.0.4.
- `relay/server.mjs` (`node:http`):
  - Clients: two per address, each built with `createGrpcClient({address, token: async () => current, tls: true, retry: true, autoIdempotency: true, timeout})` (`dist/grpc.d.ts:12-40, 375`). The unary client gets `timeout` 10 s, the bulk client 120 s. Set `channelOptions["grpc.keepalive_time_ms"] = 15000`.
  - Line routing ports `fast-reaction.ts:97-109`:
    - Shared token → `SPECTRUM_IMESSAGE_ADDRESS ?? imessage.spectrum.photon.codes:443`.
    - Dedicated → the instance whose `numbers[i] === phone`, at `${i}.imsg.photon.codes:443`, with `auth[i]`.
  - Token: plain `fetch` mint, as in `tokens.ts`. Mint at boot and refresh at `expiresIn - 60 s`. Never mint on the request path, never log a token. On `unauthenticated` or `tokenExpired`, re-mint once and retry.
  - Per-chat FIFO for message-creating ops (text, attachment, app). Typing, read, reaction and edit bypass the queue, so a tapback never waits behind an upload.
  - Upload semaphore of 1. A second upload gets 503 `not_ready` with `x-relay-sent: 0`, returned from the headers before the body is read.
  - Readiness: `/v1/ready` returns 200 only when all three hold:
    - the relay is not draining;
    - the token expires more than 60 s from now;
    - the last RPC on each live client did not fail with a connection error.

    `?deep=1` also calls `chats.count()`.
  - SIGTERM:
    1. Set `draining=true`. From then on `/v1/ready` and new requests return 503 `{code:"draining"}` with `x-relay-sent: 0`.
    2. Wait for in-flight work: up to 25 s, or 120 s for uploads.
    3. `client.close()`, then exit 0.

    The platform allows 15 min after SIGTERM (developers.cloudflare.com/containers/concepts/architecture/).
  - Logs carry op, a `sha256(chat)` prefix, latency and code. Never text, bytes, URLs or tokens (repo constraint C4).
- Minimal `/v1` surface. These are container paths; the sidecar exposes them under `/imessage/v1`.

  | Route | Body / query | SDK call (`grpc.d.ts`) | Response |
  |---|---|---|---|
  | `GET /v1/ready` | `?deep=1` | `chats.count` (deep only) | 200 `{ok, lines}` / 503 |
  | `POST /v1/chats/typing` | `{phone, chat, on}` | `chats.setTyping` | 204 |
  | `POST /v1/chats/read` | `{phone, chat}` | `chats.markRead` | 204 |
  | `POST /v1/messages/text` | `{phone, chat, text, replyTo?, linkPreview?, clientMessageId?}` | `messages.sendText` (`SendOptions`, groups d.ts:453-471) | `{guid}` |
  | `POST /v1/messages/edit` | `{phone, chat, guid, text, partIndex?}` | `messages.edit` (`grpc.d.ts:184-188`) | 204 |
  | `POST /v1/messages/reaction` | `{phone, chat, guid, partIndex?, reaction, on, clientMessageId?}` | `messages.setReaction` (`grpc.d.ts:215-218`) | 204 |
  | `POST /v1/messages/app` | `{phone, chat, message, clientMessageId?}` (`CustomizedMiniAppMessage`, groups d.ts:502-517) | `messages.sendCustomizedMiniApp` | `{guid, session}` (`MiniAppMessageResult`, groups d.ts:533-535) |
  | `POST /v1/messages/app/update` | `{phone, session, message, clientMessageId?}` | `messages.updateCustomizedMiniApp` | `{session}` |
  | `POST /v1/attachments` | raw body; headers `x-phone`, `x-chat`, `x-file-name`, `content-type`, `content-length`, `x-client-message-id?` | `attachments.upload` + `messages.sendAttachment` | `{guid}` |
  | `GET /v1/attachments/:guid` | `?phone=` | `attachments.downloadStream`: header frame → headers, `primaryChunk` → body (groups d.ts:218-226) | bytes with `content-type`, `x-file-name`, `content-length` |
  | `POST /v1/locations/request` | `{phone, chat, address, clientMessageId}` | `locations.request` | receipt |
  | `GET /v1/locations/shared` | `?phone=&address=` | `locations.get` | location or 404 |

  Errors are JSON `{code, message, retryable}`. Status map:

  | Status | Codes |
  |---|---|
  | 409 | `duplicateMessage` |
  | 404 | `messageNotFound`, `chatNotFound`, `attachmentNotFound`, `addressNotFound`, `sharedFriendLocationNotFound` |
  | 412 | `preconditionFailed` |
  | 422 | `operationNotSupported` |
  | 400 | `invalidArgument` |
  | 413 | `too_large` |
  | 429 | `dailyLimitExceeded`, `recipientLimitExceeded`, `uploadRateExceeded`, `contentDuplicateExceeded`, `recipientCoolingDown`, `recipientLocked`, `burstRateExceeded`, `newContactThrottled`, `sendReceiveRatioExceeded` |
  | 503 | `draining`, `not_ready` (always with `x-relay-sent: 0`) |
  | 502 | everything else, including `timeout`, `serviceUnavailable`, `tokenBlocked` and `unauthorized` |

  Every response carries `x-relay-sent: 0|1`, where 1 means an upstream RPC was issued. Callers treat 409 `duplicateMessage` as success: read the ledger row back, and if it is not `sent`, mark it sent with `guid = null`.
- *Deploy order* (§2.5 C18). The `air-sidecar` Worker must exist before airv2-app deploys with the `SIDECAR` binding.
  1. CI is R-CF-13's: it owns the `sidecar` check row and the `deploy-sidecar` job in `.github/workflows/workers.yml`. This PR adds the package they check and deploy, and no workflow job of its own. The container image build needs Docker on the runner.
  2. On merge, `deploy-sidecar` deploys `air-sidecar`. airv2-app.yml deploys the `SIDECAR` binding only after that Worker exists (R-CF-13's ordering).
  3. The owner then runs `npm run cf:env -- push --worker air-sidecar` (§2.5 C22). Until then the token mint fails, `/v1/ready` returns 503, and relay sends fail as retryable `not_ready` (airv2-app is still on workers.dev only in P2). After the push, the keep-warm alarm's 3-failure restart starts each container with the secrets, within about 2 min.

*Ledger migration: `supabase/migrations/NNNN_imessage_sends.sql` NEW.* `NNNN` is the next free number when this PR merges (§2.5 C23); the highest today is `0140_wzrd_connect.sql`. The migration creates no extension, so it needs no `pg_available_extensions` guard.
```sql
create table imessage_sends (
  client_message_id text primary key,
  space_hash   text not null,               -- sha256(space_id): no raw chat guid (it embeds a phone number)
  kind         text not null check (kind in ('text','reply','stream','attachment','rich_link','app','location')),
  status       text not null default 'pending' check (status in ('pending','sent','failed')),
  message_guid text,
  card_session jsonb,                        -- MiniAppCardSession ids only (lib/miniapps/cardSessions.ts:4-9)
  edit_count   int not null default 0,
  shown_chars  int not null default 0,       -- streamText resume: chars visible after the last edit
  attempts     int not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index imessage_sends_created_at_idx on imessage_sends (created_at);
alter table imessage_sends enable row level security;  -- service role only (pattern: 0004_m2_pipeline.sql:53-56)
```
Add a 7-day TTL delete for `imessage_sends` to the sweep's TTL block (`app/api/cron/sweep/route.ts:207-241`), with its count in `ttlRows`. This item owns that edit. R-CF-11 keeps it in the sweep's inline TTL pass when it moves the sweep to `scheduled()`.

*Config.*
- `lib/env.ts`: add the accessors `imessageTransport()` and `photonImessageHttpAddress()`. R-CF-01 already lists both names in `OPTIONAL_ENV` (`:60`), and they are already in the hand-edited `apps/web/env.example.md:483,485` (§2.5 C20), so this PR changes neither list. Keep `SPECTRUM_IMESSAGE_ADDRESS` (`:197`, `:865-866`); both the spectrum transport and the relay override use it.
- `apps/web/wrangler.jsonc`: add the `services` entry `{"binding":"SIDECAR","service":"air-sidecar"}`. R-CF-02 owns the rest of the file. Regenerate `apps/web/worker/worker-configuration.d.ts` in the same PR with `npx wrangler types --env-interface CloudflareEnv worker/worker-configuration.d.ts` (§2.5 C4).
- `apps/web/package.json:19`: pin `"@photon-ai/advanced-imessage": "2.2.0"` (the lockfile version). Do not take 2.4.0 (published 2026-10-22); its HTTP surface is the same. `spectrum-ts` (`:35`) stays for the Vercel transport: it is imported lazily (`sender.ts:204-220`) and never evaluated on the relay or HTTP path.
- `ARCHITECTURE.md:779-791`: record the decision. Option (c) is now the air-sidecar `ImessageRelay`; Photon HTTP is a later, gated transport; sends are keyed by `clientMessageId` and ledgered.
- `app/api/admin/imessage/probe/route.ts` NEW.
  - Guarded by `requireAdmin` (`lib/auth/guard.ts:161-171`).
  - Runs one transport op against an owner test chat (the owner provides one on a shared-pool line and one on a dedicated line; §6): `typing | text | react | attachment | app | app-update | app-update-stale | download | location`, plus `status` and `drain:<i>` (via `SIDECAR` `/ops/*`).
  - `app-update-stale` sends an update for a forged or expired session and returns Photon's error code, which pins the stale mapping in `editApp` (Q5).
  - This route is the only way to exercise the relay from outside, since the sidecar has no ingress.

*Owner action (rollout phase P0, §6 item 2: the Photon ask; not code).* Send to help@photon.codes:
```text
Spectrum Cloud project <id>, shared pool + dedicated lines. We call the iMessage plane from Cloudflare Workers,
which cannot speak gRPC (no HTTP/2 trailers). Please confirm:
1. Is there a Photon-hosted imessage-server-v2-http (REST) endpoint for Spectrum Cloud projects? Base URL for the
   shared pool, and for dedicated instances: one address with `x-photon-server: <instanceId>`, or a per-instance host?
2. Does it accept the bearer tokens from POST https://spectrum.photon.codes/projects/{id}/imessage/tokens
   (shared `token`; dedicated `auth[instanceId]`), with the same TTL?
3. If not hosted: may we self-host imessage-server-v2-http (license/image)? Alternatively, is gRPC-Web enabled on
   imessage.spectrum.photon.codes / <instance>.imsg.photon.codes?
4. clientMessageId: allowed length/charset, dedupe window, honored on edit/setReaction/sendAttachment/
   sendCustomizedMiniApp/updateCustomizedMiniApp/locations.request? Does duplicateMessage return the original
   message guid / mini-app session?
5. Which error code does updateCustomizedMiniApp return for an expired/invalid session vs an unsupported extension?
6. Limits: token-mint rate limit; per-line send rate; do edits, reactions, typing and markRead count toward the
   5,000 messages/server/day quota? Which of the rate-limit codes (burstRateExceeded, recipientCoolingDown, …) are
   safe to retry, and after how long?
7. Max attachment size and timeouts for HTTP upload; are chunked (no Content-Length) uploads accepted?
8. Which region hosts the shared plane and our dedicated instances? Any IP allowlisting? Status page/SLA?
```

**Acceptance.** Checks marked *owner-run* need production secrets, real Photon lines or Cloudflare credentials. For those, Devin puts the exact command and the expected output in the PR, and the owner runs them and reports back (§2.5 C22).
- [ ] *Owner-run.* On airv2-app (CF, workers.dev) with `IMESSAGE_TRANSPORT` unset, `/api/admin/imessage/probe` succeeds for every op against the owner-provided test chats (§6), on both a shared-pool line and a dedicated line.
- [ ] *Owner-run (probe); unit-tested with the mapped code.* `app-update-stale` returns a code that `editApp` maps to `undefined` (stale), and `updateMiniAppCard` returns `"stale"`.
- [ ] On the relay and HTTP paths, `import("spectrum-ts")` and `@grpc/grpc-js` are never evaluated (unit spy). *Owner-run:* Workers Logs show no `ERR_METHOD_NOT_IMPLEMENTED`.
- [ ] Repeating any keyed send with the same key produces exactly one bubble or card. This includes a retry after a simulated crash between the Photon accept and `ledger.done`.
- [ ] `streamText` over a fully buffered reply issues 1 `sendText` and 0 edits. A live stream issues at most 5 edits.
- [ ] *Owner-run.* Synthetic tapback timing: of 100 `react` probes against a warm relay, at least 95% finish within 1 s. The 24 h real-traffic check (`imessage ttfk reaction`, `routing/imessage.ts:148-158`, `transport: relay-direct`, `within_sla: true` on ≥95% of warm turns) is a P4 exit check (§4; §5 check 1). It does not gate this PR.
- [ ] *Owner-run.* `drain:0` during a 1 msg/s synthetic soak through the probe loses no sends and keeps the tapback p95 at or under 1 s. The instance comes back ready by itself within 60 s.
- [ ] *Owner-run, on the first image change after merge; the order is unit-tested.* A new relay image deploy upgrades `relay-0`, then `relay-1`, at most one per minute, with no failed sends.
- [ ] `air-sidecar` has no public hostname: `workers_dev: false`, `preview_urls: false` and no `routes` in `wrangler.jsonc`, confirmed by the `wrangler deploy --dry-run` output. Only the `SIDECAR` binding reaches it.
- [ ] *Owner-run.* After the first deploy and the owner's `cf:env -- push --worker air-sidecar`, `/ops/status` shows `relay-0` and `relay-1` ready within 2 min, and the first airv2-app deploy with `SIDECAR` ran after `air-sidecar` existed (§2.5 C18).
- [ ] A 50 MiB attachment sends, including from an R2-backed `{size, open}` body. A 51 MiB attachment gets 413 and the caller falls back to the rich link (`creative/imessage.ts:262-273`). Unit-tested against the fake relay; *owner-run* once through the probe.
- [ ] With the ledger table unavailable, sends still go out once (fail-open, deduped by Photon).
- [ ] On Vercel, behavior is unchanged: `IMESSAGE_TRANSPORT` unset means the spectrum transport, and every existing `lib/spectrum/*.test.ts` and `lib/orchestrator/*.test.ts` passes.
- [ ] No message text, bytes, raw chat guids or tokens appear in relay or app logs. Unit tests assert the logged fields; *owner-run:* grep Workers Logs for a canary string.

**Tests.**
- NEW unit tests next to the code:
  - `lib/imessage/transport.test.ts`: key stability, length and charset for the part tuples above; `selectTransport` defaults and fallbacks with `onWorkerd()`/`cfEnv()` mocked, including `relay` without `SIDECAR` → `spectrum`; `TAPBACK_KIND` covers exactly `TAPBACK_EMOJI`; error mapping for every row of the status table.
  - `lib/imessage/relay.test.ts`, with a fake `Fetcher`:
    - the fetcher is resolved per call through `cfEnv()`, including with only `setCfEnv(env)` set and no OpenNext request (the DO and Workflow case);
    - route and body shapes;
    - hashed `x-relay-key` and `x-idempotent`;
    - per-op timeouts;
    - 409 → duplicate;
    - 503 `x-relay-sent: 0` → retryable not-sent;
    - `FixedLengthStream` length;
    - upload retry re-calls `open()`;
    - the `maxBytes` abort.
  - `lib/imessage/http.test.ts`: `server` is sent only for dedicated lines; a missing address throws; the hand-rolled upload and download URLs.
  - `lib/imessage/tokens.test.ts`: port the cases in `lib/spectrum/fast-reaction.test.ts`.
  - `lib/imessage/sendLedger.test.ts`: `new`, `sent`, `inflight`, takeover, duplicate-without-result, fail-open on a DB error.
  - `lib/imessage/transportSender.test.ts`:
    - the method mapping;
    - `streamText` coalescing, the live throttle, and resume after a crash (`shownChars` tail keyed `imessageKey(key, "tail")`);
    - `sendReply` on not-found → `false`;
    - `editApp` stale codes;
    - per-caller `maxBytes`;
    - a keyed resend → one transport call.
- Update existing tests:
  - `lib/spectrum/fast-reaction.test.ts`: relay-direct branch.
  - `lib/spectrum/recording.test.ts`: the key is recorded.
  - `lib/spectrum/sender-contract.test.ts`: keep `advancedClientForLine` for the spectrum transport.
  - `lib/orchestrator/bubbles.test.ts` and `outbound.test.ts`: keys threaded through.
  - `lib/miniapps/cards.test.ts`: `SentApp`; `TransportError` unsupported and stale, at `:425` and `:671`.
  - `lib/location/lane.test.ts`: the key is unchanged.
  - `lib/calendar/sweep.test.ts`: the delivery key uses the pre-claim `next_run_at`, so a re-run of the same occurrence yields the same key and the next occurrence a new one.
  - `lib/trade/watch.test.ts` NEW: the alert key is identical across two ticks for the same cross (`firedAt` reused while `firing`), so a retried send results in one bubble; a new watch on the same symbol, op and price gets a new key.
- Sidecar tests (`infra/workers/sidecar/test/*.test.ts`, vitest-pool-workers as in `infra/workers/muse/vitest.config.ts`):
  - Router: the `/imessage` prefix is stripped to `/v1/*`; fnv1a pick over `relay-0`/`relay-1` and the `x-relay-instance` override; failover only on `x-relay-sent: 0` or on a throw with `x-idempotent: 1`; never for `POST /attachments`; `/ops/*`; one `imessage.send` log line per op.
  - `ImessageRelay` with a fake `ctx.container`: the alarm re-arms and never throws; restart after 3 failures; the constructor re-sets the timeout; `upgrade()` order; `scheduled` upgrades at most one instance.
  - `relay/server.test.mjs` (`node:test`) with a fake `AdvancedIMessage`: SIGTERM drain, per-chat FIFO, typing/reaction bypassing the queue, the upload semaphore answering before the body is read, the 413 cap, the error→status map, token re-mint on `tokenExpired`, readiness.
- Manual:
  - Devin, locally: `cd infra/workers/sidecar && npx wrangler dev` (local containers need Docker), then `curl localhost:8787/imessage/v1/ready`.
  - Owner-run (Devin supplies the commands and expected output in the PR):
    - `npx wrangler tail air-sidecar`.
    - From `opennextjs-cloudflare preview` or a workers.dev deploy, run `POST /api/admin/imessage/probe` once per op against the §6 test chats.
    - Drills: `drain:0` while sending; deploy a no-op image change and watch the staggered upgrade.

**Risks & notes.**
- Containers have no uptime guarantee: hosts restart on an irregular cadence (SIGTERM, then up to 15 min to drain). A cold start (1-3 s, plus Node, the token mint and channel setup) misses the 1 s SLA and is logged `within_sla:false`.
- The `durable_object` scheduling policy is in public beta (CF changelog 2026-09-30), and its instances do not take part in rollouts. Image updates rely on the cron-driven `upgrade()` above. If the policy proves unstable, the `default` policy fallback is: `image`, `instance_type: "lite"`, `max_instances: 2` (the same two instances, so the §2.5 C14 numbers and the cost math below still hold), `rollout_step_percentage: [50, 100]`, and `start()` with no `image`/`instance` options.
- Container placement relative to Photon's region adds latency (Photon Q8, `locationHint`).
- `lite` has 256 MiB. A 50 MiB upload is buffered by the SDK (`groups-BYjWoH6H.d.ts:207-217`), and the semaphore keeps the peak to one upload. If you see OOM, pass `instance: "basic"` to `start()`.
- Vendor quota is 5,000 messages per server per day (`.agents/skills/spectrum/providers/imessage.md:60`). Edits and reactions may count toward it (Q6).
- Dropping the `getMessage` prefetches removes the client-side direction checks (`sender.ts:245-250, 261-267`). Callers only pass inbound ids: webhook ids, and `tapbackTarget` from drained inbound rows (`flush.ts:1903-1905`).
- The ledger adds about 2 Supabase round trips per keyed creating send. Reactions, typing, read and edits skip it.
- A duplicate with no stored result (crash between the Photon accept and `done`) loses the guid or card session. Later in-place updates then return `stale` (`cards.ts:611-613`), and `updateMiniAppCard` never sends a replacement (`cards.ts:558-562`). `sendOrUpdateAppCard` falls through to a fresh send (`cards.ts:315-342`); checkout and vault refreshes keep the old bubble.
- On Vercel the spectrum transport ignores keys except for locations, so dedupe there is ledger-only.
- If Photon never ships HTTP, the relay is permanent. airv2-app still needs `SPECTRUM_PROJECT_SECRET` for `lib/spectrum/users.ts:44-67`.
- Cost: two always-on `lite` instances.
  - Memory: 2 × 0.25 GiB × 730 h = 365 GiB-h, minus 25 included = 340 × $0.009 = $3.06.
  - Disk: 2 × 2 GB × 730 h = 2,920 GB-h, minus 200 included = 2,720 × $0.000252 = $0.69.
  - vCPU is billed on active time only.
  - Containers total ≈ $3.75/mo above the $5 Paid base.
  - Plus about $12.50/mo of DO duration. The two container-backed relay DOs stay in memory all month (2 × 0.125 GB × 2,628,000 s ≈ 657k GB-s), which bills one rounded 1M GB-s unit (§3.3). `ConversationDO` shares that unit.
- `waitUntil` is capped at 30 s on both plans, so long send sequences must run in R-CF-04 / R-CF-06 contexts, and out-of-turn sends go through `ConversationDO.deliver` once R-CF-04 lands (§2.5 C8). Never put bubble sends on an unordered Queue.
- R-CF-15 owns the alerts on `within_sla` and relay readiness (A7, A8). It builds on this item; this item does not wait for it.

**Depends on.** R-CF-01 (`## secret @air-sidecar` block and `cf:env -- push --worker`; `IMESSAGE_TRANSPORT` and `PHOTON_IMESSAGE_HTTP_ADDRESS` in `OPTIONAL_ENV`), R-CF-02 (entry, `applyEnv`, base `wrangler.jsonc` for the `SIDECAR` binding), R-CF-12 (`lib/runtime/platform.ts`: `onWorkerd()`, `cfEnv()`), R-CF-13 (`deploy-sidecar` job and the deploy order of §2.5 C18). All four are P1.
