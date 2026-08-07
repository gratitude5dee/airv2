-- M7: one Composio session per user. The session id keys the per-user MCP
-- endpoint; Composio holds the OAuth tokens (C10) — nothing sensitive here.

alter table users add column composio_session_id text;
