-- M14 task 2 (C22): the deploy wizard proposes ad-group and ad mutations,
-- so the gated write kinds widen. Every one of these is spend-mutating and
-- stays behind the 'ad_write' decision gate; asset upload is not a kind here
-- because it moves no money and stays ungated.
alter table ad_writes drop constraint ad_writes_kind_check;
alter table ad_writes add constraint ad_writes_kind_check
  check (kind in ('create_campaign','update_budget','set_status',
                  'create_ad_group','create_ad','update_ad'));
