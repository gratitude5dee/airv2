-- Air Create (V11) MC5 Functions — docs/goal-create-v11.md §11, §14.2.
--
-- 0083 created miniapp_functions and miniapp_runtime_tokens. This adds what
-- the backend lane needs on top, additively:
--   * the declaration the last build staged (db/kv/egress/cap/entry — the
--     working tree's proposal; it never governs a live Worker),
--   * the approved manifest's timestamp and the active runtime-token row
--     (the manifest carries the row id as an opaque reference; the secret
--     lives only in the Outbound Worker's KV, its hash only in
--     miniapp_runtime_tokens),
--   * secret set-at dates (names + dates only, never values — §11.4),
--   * the owner/admin kill switch,
--   * a per-version functions record (module digest + declaration) so a
--     promote or rollback redeploys exactly the module that was previewed.
-- Nothing here holds source, a secret value, or a runtime token.

alter table miniapp_functions
  add column if not exists declared jsonb,
  add column if not exists declared_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists runtime_token_id uuid references miniapp_runtime_tokens(id) on delete set null,
  add column if not exists secret_set_at jsonb not null default '{}'::jsonb,
  add column if not exists killed_at timestamptz,
  add column if not exists killed_by text check (killed_by is null or killed_by in ('owner','admin')),
  add column if not exists updated_at timestamptz not null default now();

alter table miniapp_versions
  add column if not exists functions jsonb;

-- A backend approval or an egress/budget change is a Needs-you item; the
-- decision row's ref is the slug (as miniapp_publish). Kind already allowed
-- since 0083; this index makes "one pending backend decision per app" cheap.
create index if not exists decisions_kind_ref_pending_idx
  on decisions (user_id, kind, ref) where status = 'pending';

-- Runtime-token rows are looked up by hash on every gateway call from a user
-- Worker; the unique index from 0083 serves that. Rotation revokes the old
-- row, so the active one per app is the one with revoked_at null.
create index if not exists miniapp_runtime_tokens_active_idx
  on miniapp_runtime_tokens (app_id) where revoked_at is null;

-- Content-free request ring for the Functions tab (§5.1): one row per
-- runtime-API call, ref = '<slug>:<status>', no body, no path beyond the
-- route kind in bytes=0. fn_capped stays the cap event.
alter table ops_events drop constraint ops_events_kind_check;
alter table ops_events add constraint ops_events_kind_check check (kind in (
  'store_open','launch','publish','upload','upload_rejected',
  'guest_session','grant','rate_limited','pair_attempt',
  'build','build_failed','deploy_fn','fn_capped','rollback','import',
  'create.drop','create.push','create.build','create.turn','create.qa',
  'fn_request','fn_secret','fn_rotate','fn_kill','fn_backend'
));

-- CR8: the app's daily inference counter, rolled on write like add_spend so
-- a stale day can never keep accumulating. Service role only.
create or replace function miniapp_fn_spend(p_app_id uuid, p_usd numeric)
returns numeric as $$
  update miniapp_functions
     set ai_spent_today_usd = case
           when ai_spend_day = (now() at time zone 'utc')::date then ai_spent_today_usd + p_usd
           else p_usd
         end,
         ai_spend_day = (now() at time zone 'utc')::date,
         updated_at = now()
   where app_id = p_app_id
  returning ai_spent_today_usd;
$$ language sql security definer;

revoke all on function miniapp_fn_spend(uuid, numeric) from public;
grant execute on function miniapp_fn_spend(uuid, numeric) to service_role;
