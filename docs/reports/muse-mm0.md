# Air × Muse MM0 protocol probe

Status: implementation baseline — the live Muse connector-form run is pending a
Muse account sign-in.

## Purpose

MM0 is a deliberately data-free deployment at `https://muse.wzrd.tech`. It is
an OAuth 2.1 authorization server, an MCP server, and nothing more. Its only
tool, `air.whoami`, returns this fixed object:

```json
{"handle_display":"MM0 probe","link":"stub","box":"none","stage":"mm0"}
```

It makes no control-plane request and has no Air account, phone, line, Box,
inbox, calendar, wallet, card, or decision capability. This preserves the MM0
gate in `muse.md`: no product capability is built or exposed until Muse's
actual client behaviour has been recorded.

## Implemented protocol surface

- `POST /mcp`: stateless, JSON MCP transport, bearer protected.
- `GET /.well-known/oauth-protected-resource/mcp`: RFC 9728 resource metadata.
- `GET /.well-known/oauth-authorization-server`: OAuth authorization-server metadata.
- `POST /register`, `GET|POST /authorize`, `POST /token`: DCR plus OAuth 2.1
  authorization-code flow with S256 PKCE and refresh-token rotation.
- `GET /__air/health` and `GET /muse.md`: operational and human-readable probe
  endpoints.

The authorization screen never silently grants. It uses a short-lived,
host-only, `HttpOnly`, `Secure`, `SameSite=Lax` CSRF cookie and a constant-time
digest comparison before it creates a probe grant. It stores only the literal
MM0 stage in unencrypted OAuth grant metadata.

## Verification record

| Probe | Result | Evidence / next action |
| --- | --- | --- |
| P1: connector-form OAuth/MCP handshake | Pending | Run the live Muse connector form with `https://muse.wzrd.tech/mcp`; capture every request/response header and body shape (redacted). |
| P2: iMessage relay reachability | Pending | Requires a real authorized Air identity after P1. |
| P3: MCP JSON and timeout behaviour | Pending | Run `tools/list` and `air.whoami` inside Muse after P1. |
| P4: Muse Raw API access | Pending | Verify from a real Muse workspace. |
| P5: connector-form dry run | Pending | Submit the data-free connector only; do not publish a product connector. |
| P6: GP2 task-shape fit | Pending | Requires an observed Muse task payload. |
| P7: mail primitives | Pending | Requires a real Muse workspace/API session. |
| P8: WebMCP | Pending | Verify only after the stable remote connector path is understood. |

The local conformance suite verifies metadata, resource discovery, the bearer
challenge, the data-free endpoints, and that authorization requests are not
auto-approved. It also completes DCR → S256 PKCE → approval → token exchange
→ `air.whoami` against the Worker runtime. The current MCP transport needs
`MCP-Protocol-Version: 2026-07-28`, `Mcp-Method`, and (for `tools/call`)
`Mcp-Name`, plus a matching per-request `_meta` envelope in `params`. Its
response is a single JSON object. The Worker rejects the legacy 2025 transport
with `-32022` after authentication rather than falling back to SSE.

The current local test runtime supports compatibility date `2026-08-22`; the
deployed Worker remains configured for the required `2026-09-20`. Record
production observations, including Muse's actual protocol version and redirect
allow-list behaviour, in this report before implementing MM1+.
