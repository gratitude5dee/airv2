# P1-11: box template bakes one shared Daytona API key into every fork

Status: resolved — PR #127

Template no longer logs in with a shared key (and scrubs any inherited
`~/.daytona` profile); provisioning mints a per-user Daytona child key
(`write:sandboxes`/`delete:sandboxes`) via a server-side manager key and
injects it into the box env; deletion revokes it. Lane stays disabled when
the manager key is unconfigured. Existing forked boxes still hold the old
shared key: rotate/revoke it at Daytona and re-provision.

See `docs/review-2026-08/01-engineering-review.md` (and 02 for mini-app items) for full detail.
