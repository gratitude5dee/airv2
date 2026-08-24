-- Character sheets are generated in two steps: render a draft, then the
-- owner confirms it into the vault (or discards it). Drafts carry their own
-- role so vault listings, avatar choices, and twin references never surface
-- an unconfirmed sheet.
alter table identity_assets drop constraint identity_assets_role_check;
alter table identity_assets add constraint identity_assets_role_check
  check (role in ('selfie','character_sheet','character_sheet_draft','avatar'));
