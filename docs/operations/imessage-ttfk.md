# iMessage time-to-first-kindness policy

Every trusted inbound iMessage has a feedback path that does not wait for a Hermes wake or tool run.

| Deadline from receipt | User-visible action | Source |
| --- | --- | --- |
| Under 1 second target | `👀` reaction | deterministic Spectrum tapback |
| Under 5 seconds target | first bubble | deterministic arithmetic, GLM fast lane for other simple questions, or a task-aware holding line |
| 10 seconds | progress update if no reply started | GLM fast lane, deterministic deadline fallback |
| 20 seconds | second progress update if no reply started | GLM fast lane, deterministic deadline fallback |
| 35 seconds | finalizing update if no reply started | GLM fast lane, deterministic deadline fallback |

The sender connection and fast-response computation begin in parallel before the webhook returns. The reaction does not wait for debouncing, box provisioning, or a model call. Telemetry records elapsed time and whether the target was met; it never records message contents.

Each burst-start first-bubble attempt also lands a durable receipt on `agent_runs` (`outcome` `first_bubble` / `first_bubble_failed`, `ttfk_ms`, `ttfk_met`, `ttfk_lane` = the `initialResponse` source), so the fast-lane vs fixed-template decision can be read from the receipts ledger rather than log lines.

A deterministic arithmetic answer is final and removes that exact inbound row before the scheduled flush, so Hermes does not replay history or send progress messages for an already-solved calculation. A GLM response tagged `FINAL:` behaves the same way; `HOLD:` keeps the full agent turn for tool-dependent work.

## Provider policy

The fleet currently uses the GMI platform key. The `fast` gateway alias maps to the approved GMI GLM fast model for the initial-response and status lanes. Do not introduce a per-user Groq credential or bypass the gateway while the GMI override is active. The full Hermes turn follows normal gateway routing, which may select GLM or Astra.

## Completion behavior

Timed status messages stop when the real reply begins streaming, when the turn exits, or when the outbound connection cannot be established. The 35-second message is a visible finalization update, not a destructive timeout: interrupting an in-progress tool task solely to satisfy a chat timer could lose user work. The actual reply is delivered as soon as the turn completes.
