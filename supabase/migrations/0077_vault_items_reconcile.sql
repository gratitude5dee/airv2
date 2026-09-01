-- Reconcile vault_items with 0022_vault.sql. The deployed table only ever got
-- id/user_id/name/created_at/default_for_purchases, so every metadata mirror
-- upsert from lib/vault/client.ts failed and every `.eq("kind", ...)` read
-- errored — which the purchase paths reported as "no cards in the vault".
-- Idempotent: safe on a database already matching 0022.

alter table vault_items
  add column if not exists kind         text,
  add column if not exists masked       text,
  add column if not exists env_var      text,
  add column if not exists totp_enabled boolean not null default false,
  add column if not exists updated_at   timestamptz not null default now(),
  add column if not exists deleted_at   timestamptz;

-- Pre-drift rows predate the column entirely; default_for_purchases was the
-- only kind-bearing flow that wrote them, so they are cards.
update vault_items set kind = 'card' where kind is null;
update vault_items set name = '(unnamed)' where name is null;

alter table vault_items alter column kind set not null;
alter table vault_items alter column name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vault_items_kind_check'
  ) then
    alter table vault_items add constraint vault_items_kind_check
      check (kind in ('login', 'card', 'api_key', 'note', 'identity'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'vault_items_user_id_env_var_key'
  ) then
    alter table vault_items add constraint vault_items_user_id_env_var_key
      unique (user_id, env_var);
  end if;
end $$;

create index if not exists vault_items_user_kind_idx on vault_items (user_id, kind);

alter table vault_items enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'vault_items' and policyname = 'own_vault_items'
  ) then
    create policy own_vault_items on vault_items
      for select using (user_id = auth.uid());
  end if;
end $$;
