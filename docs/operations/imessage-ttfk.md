# iMessage time-to-first-kindness policy

Every trusted inbound iMessage has a feedback path that does not wait for a Hermes wake or tool run.

| Deadline from receipt | User-visible action | Source |
| --- | --- | --- |
| Under 1 second target | `👀` reaction | deterministic Spectrum tapback |
| Under 5 seconds target | first bubble | GLM fast lane for simple questions; deterministic task-aware line otherwise |
| 10 seconds | progress update if no reply started | GLM fast lane, deterministic deadline fallback |
| 20 seconds | second progress update if no reply started | GLM fast lane, deterministic deadline fallback |
| 35 seconds | finalizing update if no reply started | GLM fast lane, deterministic deadline fallback |

The sender connection begins before the webhook returns. The reaction does not wait for debouncing, box provisioning, or a model call. Telemetry records elapsed time and whether the target was met; it never records message contents.

## Provider policy

The fleet currently uses the GMI platform key. The `fast` gateway alias maps to the approved GMI GLM fast model for the initial-response and status lanes. Do not introduce a per-user Groq credential or bypass the gateway while the GMI override is active. The full Hermes turn follows normal gateway routing, which may select GLM or Astra.

## Completion behavior

Timed status messages stop when the real reply begins streaming, when the turn exits, or when the outbound connection cannot be established. The 35-second message is a visible finalization update, not a destructive timeout: interrupting an in-progress tool task solely to satisfy a chat timer could lose user work. The actual reply is delivered as soon as the turn completes.
