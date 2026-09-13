-- /freeze video lane: the still can come from a frame of an uploaded clip,
-- and the rendered camera move stitches back into that clip at the picked
-- frame (before ▸ freeze ▸ after, like the reference editor).
--
-- clip_asset_id points at the owner's original upload, stored out-of-band
-- via a signed storage URL (the 12MB action body cap can't carry video).
-- clip_in / clip_out bound the ≤30s window the stitch keeps; freeze_at is
-- the absolute source time the frozen frame lands on.
alter table freeze_sessions
  add column clip_asset_id uuid references creative_assets(id) on delete set null,
  add column clip_in double precision,
  add column clip_out double precision,
  add column freeze_at double precision,
  add constraint freeze_clip_window check (
    (clip_asset_id is null and clip_in is null and clip_out is null and freeze_at is null)
    or (
      clip_asset_id is not null
      and clip_in is not null and clip_in >= 0
      and clip_out is not null and clip_out > clip_in
      and freeze_at is not null and freeze_at between clip_in and clip_out
    )
  );
