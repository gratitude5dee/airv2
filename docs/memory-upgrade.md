memory-upgrade.md — deep memory for the per-user Hermes agent (§MA9.1 extension)

Read `ARCHITECTURE.md` §1 (one computer per user) and `goal.md` §MA9 before this file. This is not a new subsystem: `goal.md` §MA9.1 already shipped Hermes native memory and §MA9.2 already ships onboarding context files into the box. This file specifies the layer above them — semantic recall over everything the box knows — and says explicitly what not to build. Where this file and `ARCHITECTURE.md` disagree, `ARCHITECTURE.md` wins and this file is the bug.

## 0. Goal

Every Air user gets rich, durable long-term memory: the agent remembers preferences, people, decisions, and history across iMessage, web chat, and email, and it can *recall* the onboarding context it was given — not just have the files sitting on disk. All of it stays box-local: memory content lives in the user's own filesystem, never in the shared Supabase (C4/I2), and it snapshots and restores with the box like every other byte in `~/.hermes`.

Two halves, both required. **Ingest**: onboarding context (iMessage history, Onairos persona) becomes semantically searchable, not just readable-if-the-agent-guesses-the-path. **Recall**: the agent retrieves against it at response-generation time, on every surface, because every surface is the same session (`MAIN_SESSION = "air-main"`, `apps/web/lib/hermes/client.ts`).

## 1. What already exists — audit before you write code

Do not rebuild any of this. Extend it.

| Piece | Where | State |
|---|---|---|
| Hermes native memory, enabled per box | `infra/template/setup.sh` §3 — `memory.memory_enabled: true`, `user_profile_enabled: true`, `write_approval: false` | Live. Writes `~/.hermes/memories/MEMORY.md` + `USER.md`; Hermes injects both into the system prompt every turn. |
| Memory block reconciled on old boxes | `infra/template/sync-box.sh` §6 | Live. Boxes forked before the memory block get it in place; user data is never touched. |
| Read/write/clear plumbing | `apps/web/lib/memory/files.ts` (`MEMORY_PATH`, `USER_PROFILE_PATH`, `USER_PROFILE_CHAR_LIMIT = 1375`) | Live. Box → owner-session response only. |
| Owner API + UI | `apps/web/app/api/me/memory/route.ts`, Settings memory section, `apps/web/app/home/panels/context-panel.tsx` | Live. `MEMORY.md` read-only, `USER.md` editable, clear-with-confirm. |
| Memory in export | `apps/web/app/api/admin/export/route.ts` (`archive.memory_files`) | Live. Both files ride the archive; box-unavailable is reported honestly. |
| iMessage history ingest | `apps/web/lib/imessage/ingest.ts` → `.hermes/context/imessage-history/` | Live. HMAC upload ticket, extractor posts chat.db rows, Postgres sees counts only. |
| Onairos persona | `apps/web/lib/onairos/sync.ts` → `.hermes/context/onairos.md` (+ JSON, + grant) | Live. `USER.md` gets one pointer line; disconnect deletes the files. |
| One session across all surfaces | `apps/web/lib/hermes/client.ts` — `MAIN_SESSION = "air-main"` | Live. iMessage, web, email, cron all land in the same session, so memory is shared by construction. |
| MCP is a config write, not an integration | `ARCHITECTURE.md` §7.3; `hermes mcp add`, `mcp_servers` in `~/.hermes/config.yaml`; precedents: daytona (`setup.sh` §3b, stdio) and AgentMail (`apps/web/lib/provisioning/email.ts`, HTTP + `${VAR}` header) | Live. Adding a memory server is the same shape. |

**The gap.** Native memory is a ~1–2 KB budgeted summary in the system prompt. It cannot hold a year of iMessage history or an Onairos persona, and there is no retrieval path over `.hermes/context/` — the agent finds those files only if it thinks to `grep` them. So the honest current state is: *the agent has a good profile and a pile of unindexed context next to it.*

## 2. The three-layer model

**(a) Working memory — Hermes native. Keep exactly as-is.** `MEMORY.md` + `USER.md`, agent-authored, always in the prompt, owner-editable, no retrieval cost. This is the hot, small, always-true layer. Do not migrate it, do not mirror it, do not let a new layer write it. Its 1,375-char `USER.md` bound is a feature: it is the prompt budget.

**(b) Deep semantic recall — new. OpenViking as a per-box MCP server (§3).** Cold, large, retrieved on demand: full iMessage history, the Onairos persona, imported documents, per-session extracted memories. The agent queries it when a task warrants memory and writes durable conclusions back. This is the layer this spec ships.

**(c) Temporal / graph reasoning — deferred option. Hindsight, embedded, box-local (§4).** Only if measured need appears for "what did I think about X in March, and what changed" — multi-arm recall (semantic + BM25 + graph + temporal) and fact consolidation. Not in the first cut.

Layer discipline: **(a) is the index card, (b) is the archive, (c) is the historian.** A fact belongs in exactly one place; (b) must never try to be (a) by rewriting the prompt files.

## 3. Layer (b) — OpenViking in the box

### 3.1 Shape

One OpenViking server per box, on localhost, storing to the box filesystem; Hermes reaches it as an MCP server over `http://127.0.0.1:1933/mcp`; the existing `openviking-memory` skill teaches the agent the recall/persist loop. Nothing leaves the box, so the entire feature is inside the C4 boundary by construction — the same reason the vault and the mini-app state store are box-side.

- **Install + service.** `pip install openviking` into the template (its own venv — do not pollute `$HERMES_VENV`), workspace under `~/.openviking/`, config at `~/.openviking/ov.conf`, a `openviking.service` systemd unit alongside `hermes-host` / `hermes-gateway` / `hermes-dashboard` (`infra/template/`). Bind `127.0.0.1` only: local mode needs no API key, and a localhost-bound server has no door to close (C12's posture — no second door into the agent).
- **MCP registration.** `mcp_servers.openviking = {url: "http://127.0.0.1:1933/mcp", enabled: true}` in `~/.hermes/config.yaml`, written the way AgentMail's entry is written (`hermes mcp add` where it validates, the YAML-merge script where it does not), baked into `infra/template/setup.sh` and reconciled idempotently by `infra/template/sync-box.sh` §6 — same "if the key is missing, add it, never clobber user edits" rule as the memory block.
- **Skill.** Install the existing `openviking-memory` skill (OpenViking repo, `agent-plugins/skills/openviking-memory/`, SKILL.md + `references/`) into `~/.hermes/skills/openviking-memory/` through the template's local-skill loop, so it is template-owned and replaced on sync like `air-onboarding` and `vault-use`. Do not write a new skill: it already encodes the right policy (retrieve for multi-step work, skip for trivia, treat memory as advisory below system/user instructions, never persist secrets or scrollback).
- **Models.** VLM + query-planner point at the box's own gateway (`provider: "openai"`, `api_base` = the per-box `base_url` in `config.yaml`, key = `GATEWAY_TOKEN` from `~/.hermes/.env`) so summarization and memory extraction are metered like every other token the box spends and no provider key enters the box (C2). **Embeddings stay on OpenViking's built-in `local` dense model** — the gateway allows only `chat/completions` and `models` (`apps/web/app/api/gateway/v1/[...path]/route.ts` rejects every other path), so a hosted embedding provider is not reachable without first adding a metered `embeddings` path to the gateway. Local embeddings are the default and the cheaper answer; if a task wants hosted embeddings, that gateway path is the prerequisite, not a config tweak.
- **Storage.** `agfs.backend: local`, `vectordb.backend: local`, workspace inside `$HOME` so it rides the box snapshot. No S3, no Redis, no shared vector service — a shared vector store would be C4 laundering: embeddings of a user's messages are still that user's content.

### 3.2 Wiring onboarding context in

Ingest is the point of the whole layer. Today `apps/web/lib/imessage/ingest.ts` and `apps/web/lib/onairos/sync.ts` leave files on disk; they must additionally register that content with OpenViking so it is retrievable.

- **iMessage history** → `add_resource` per chunk as the extractor uploads it (the ingest path already runs box-side commands after each chunk write), under a stable resource path per thread. Chunked, resumable, idempotent on re-upload: re-ingesting the same chunk must not duplicate. Conclusions, not scrollback, is the skill's rule for `remember`; raw history is a *resource*, not a memory — file it as one.
- **Onairos persona** → `add_resource` on `onairos.md` plus a `remember` pass over the structured persona so stated preferences land as memories, not just a document. Re-sync re-registers; **disconnect must `forget` the persona memories and drop the resource**, or §MA9.2's "zero Onairos-derived bytes" acceptance regresses into a lie.
- **Ongoing turns.** OpenViking session commit extracts memories asynchronously; the agent also persists explicitly via `remember` per the skill. Native memory keeps writing `MEMORY.md`/`USER.md` independently — two writers, two stores, no sync (see §2).
- **Failure posture.** Every ingest hook is best-effort: OpenViking down or still indexing must never fail an onboarding step or a turn. Log counts, never content.

### 3.3 Control-plane surface

Supabase gets metadata only: whether deep memory is enabled for the user and the provider's health. No memory content, no embeddings, no counts of message text beyond what ingest already logs (§5). Settings shows deep memory as a status row next to the existing memory section: enabled/disabled, last index time, resource count, a re-index button, and clear-with-confirm — all reading the box through owner-session APIs, exactly like `context-panel.tsx` reads `MEMORY.md` today.

### 3.4 Box cost

OpenViking adds a resident Python process, a local embedding model, and a vector index to a box sized `default` (4 vCPU / 8 GB, `ARCHITECTURE.md` §sizing) that already carries Hermes, Node, ffmpeg, and a headless browser. Measure before shipping to everyone: resident RSS with the server idle, first-index wall time for a year of iMessage history, and query latency at p50/p95 while the browser is open. If idle cost is material, run the server on-demand (socket/systemd activation) rather than jumping to `large`.

## 4. Layer (c) — Hindsight, deferred

If temporal/graph recall proves necessary, add Hindsight **embedded, entirely inside the user's box**: `hindsight-embed` runs a local daemon with its own embedded PostgreSQL (pg0) on localhost, exposed to Hermes as another MCP server. Its Postgres is *not* the shared Supabase and must never be pointed at it — one bank per box, one box per user (I1). Any design that puts memory banks in the shared Postgres is rejected on C4/I2 without further discussion.

What it buys that (b) does not: multi-arm recall with reciprocal-rank fusion, fact consolidation into observations, entity resolution, mental models. What it costs: a second embedded database plus ML models in the same 8 GB, a documented 1–3 minute first-run cold start (models + dependencies) against a box that is stopped between conversations and expected to answer an iMessage in seconds, and a second memory substrate to keep coherent with (a) and (b). **Gate:** ship (b), instrument recall quality, and adopt (c) only against a named failure that (b) demonstrably cannot serve — with the box likely moving to `large`, and the cold start hidden behind the existing keep-awake/wake path or a warmed daemon.

## 5. Data boundary — non-negotiable

- Shared Supabase stores **metadata only**: deep-memory enabled flag, provider status (`disconnected`/`indexing`/`active`/`error`), timestamps, error codes. Never memory text, never message text, never embeddings, never resource bodies. Same rule the Onairos and Composio connection rows follow (C4/I2, `ARCHITECTURE.md` §3.2).
- **Logs carry counts and identifiers, never content** — the discipline `lib/imessage/ingest.ts` and `lib/onairos/sync.ts` already keep.
- **Snapshot/restore with the box.** The OpenViking workspace lives under `$HOME`, so stop/resume and fork preserve it like `~/.hermes`. A memory store that does not survive a box stop is not memory.
- **`/api/admin/export` includes it.** Extend `archive` beyond `memory_files` with the deep-memory store (resource + memory inventory and their contents, or an honest box-unavailable note in the existing shape). Deletion deletes it: the §MA11 deletion script must drop the workspace with the box.
- **Owner-only.** Every read path is an owner-session control-plane request through `lib/box/*`; no admin reads memory content without the consent path §7.4 already defines for the dashboard.

## 6. Acceptance

- [ ] **(§MA9.1, unchanged)** A preference stated on iMessage today is reflected in tomorrow's web chat — memory survives stop/resume because it is the same filesystem.
- [ ] Memory contents appear in **no** Postgres row and **no** log line. Prove it: run the flow with query logging on, grep the day's logs and a full table dump for a distinctive phrase from the imported history, expect zero hits.
- [ ] **Semantic recall of ingested context**: after onboarding imports iMessage history, the agent answers a question whose only source is an old thread — a preference *never typed into Air* — and the retrieval trajectory names the ingested resource. (This is §MA9.2's bar generalized from one persona file to the whole archive.)
- [ ] OpenViking cold-box path: box stopped → inbound iMessage → wake → recall-backed reply within the existing flush-job latency budget, no OOM with the browser open.
- [ ] Ingest is idempotent: re-running the extractor over the same chat.db produces no duplicate resources and no duplicate memories.
- [ ] Onairos disconnect leaves zero persona bytes in *either* layer: files gone, resources dropped, memories forgotten.
- [ ] `/api/admin/export` for a user with deep memory on round-trips the store; export for a deleted user 404s.
- [ ] A box forked before this change, after `sync-box.sh`, has the MCP entry, the skill, and a working server — with its existing memory, sessions, and vault untouched.
- [ ] Deep memory off (server absent or disabled) degrades to today's behavior: the skill's own rule is "if no OpenViking tools are registered, continue without memory." No turn fails.

## 7. Comparison

| | Hermes native memory | OpenViking (layer b) | Hindsight (layer c) |
|---|---|---|---|
| Storage substrate | Two markdown files in `~/.hermes/memories/` | `viking://` filesystem + local vector index, box filesystem | Embedded PostgreSQL/pgvector (pg0) in the box |
| Retrieval strategy | None — always in the system prompt | Hierarchical directory-recursive vector search, tiered L0/L1/L2 loading, observable trajectory | Multi-arm (semantic + BM25 + graph + temporal) with RRF fusion, consolidation into observations |
| Capacity | ~prompt budget (`USER.md` capped at 1,375 chars) | Whole archive: history, documents, extracted memories | Whole archive + derived fact graph |
| MCP compatibility | n/a (native tools) | Built-in `/mcp` on the same port; `mcp_servers` entry | MCP integration available; second local daemon |
| Box cost | ~zero | One Python process + local embedding model + index; measure RSS and index time | Second daemon + embedded Postgres + ML models; documented 1–3 min first-run cold start |
| C4 / I2 compliance | Yes — files in the box | Yes — localhost server, local storage; no shared vector service | Yes **only** if its Postgres is the box's own, never the shared Supabase |
| Verdict | Keep as-is, always on | **Ship first** | Optional, behind a measured need |

**Recommendation: ship OpenViking, keep native memory untouched, leave Hindsight as a documented option.** Layer (b) is a config write plus an ingest hook on rails that already exist (`mcp_servers`, template skills, `sync-box.sh`, the two ingest modules); layer (c) is a second database in an 8 GB box, and nothing today proves we need it.

## 8. Escalate, do not decide

- Any proposal to store memory content, embeddings, or message text in the shared Supabase, or to point Hindsight's Postgres at it. C4/I2 are right; the proposal is the bug.
- Any shared/multi-tenant vector service or hosted memory provider — it moves content out of the box (I1) and needs an explicit product decision, not an implementation choice.
- Adding an `embeddings` path to the gateway (metering, caps, and cost model implications).
- Moving the default box size, or accepting a cold-start regression on the iMessage path, to fit a memory layer.
- Any change that would let layer (b) or (c) write `MEMORY.md` / `USER.md`.
