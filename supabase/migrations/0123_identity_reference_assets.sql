-- Owner-selected source photos for the digital-twin reference set. Raw
-- selected photos remain private; reference_sheet is a private derived
-- contact sheet used by one-image generation models.

alter table identity_assets drop constraint if exists identity_assets_role_check;
alter table identity_assets add constraint identity_assets_role_check
  check (role in (
    'selfie','character_sheet','character_sheet_draft','avatar',
    'profile_image','profile_image_draft','alt_image','reference_sheet',
    'reference_video','voice_sample','consent_recording'
  ));

create table if not exists identity_reference_assets (
  user_id    uuid not null references users(id) on delete cascade,
  asset_id   uuid not null references creative_assets(id) on delete cascade,
  position   integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, asset_id),
  unique (user_id, position)
);

create index if not exists identity_reference_assets_user_position_idx
  on identity_reference_assets (user_id, position);

alter table identity_reference_assets enable row level security;
drop policy if exists own_identity_reference_assets on identity_reference_assets;
create policy own_identity_reference_assets on identity_reference_assets
  for select using (user_id = auth.uid());

-- Replacing a set must be atomic: an insert conflict must not leave the
-- owner with an empty selection or a contact sheet that no longer matches.
-- The application still validates before composing the sheet; this function
-- repeats the ownership/ready-selfie checks at the write boundary.
create or replace function replace_identity_reference_assets(
  p_user_id uuid,
  p_asset_ids uuid[]
) returns void
language plpgsql
set search_path = public
as $$
declare
  selected_count integer := coalesce(cardinality(p_asset_ids), 0);
  valid_count integer;
begin
  if selected_count < 1 or selected_count > 6 then
    raise exception 'identity reference selection must contain 1 to 6 assets';
  end if;

  if (select count(distinct selected.asset_id)
      from unnest(p_asset_ids) as selected(asset_id))
     <> selected_count then
    raise exception 'identity reference assets must be unique';
  end if;

  select count(distinct identity_assets.asset_id) into valid_count
  from identity_assets
  where user_id = p_user_id
    and asset_id = any(p_asset_ids)
    and role = 'selfie'
    and status = 'ready';
  if valid_count <> selected_count then
    raise exception 'identity reference assets must be owned ready selfies';
  end if;

  delete from identity_reference_assets where user_id = p_user_id;
  insert into identity_reference_assets (user_id, asset_id, position)
  select p_user_id, asset_id, (ordinal - 1)::integer
  from unnest(p_asset_ids) with ordinality as selected(asset_id, ordinal);
end;
$$;
