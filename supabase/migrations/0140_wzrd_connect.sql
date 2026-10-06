-- R-CONN-01: WZRD Connect — self-hosted connector gateway (connector.wzrd.tech).
-- One runtime token per user: the token id keys the worker's token record and
-- the oct_ secret is the box-side credential the /api/mcp/wzrdconnect proxy
-- injects. The secret is stored plaintext deliberately — the worker returns
-- it once at mint time, and the user's token only ever grants their own
-- connection ids, so its blast radius is bounded by the user's grants.
alter table users add column wzrd_connect_token text;
alter table users add column wzrd_connect_token_id text;
