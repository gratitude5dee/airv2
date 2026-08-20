-- P0-1: a throw during the thirdweb submit is ambiguous — the transaction
-- may or may not have broadcast (C23). Such transfers land in
-- 'submit_unknown', a terminal state that is never reset to pending, so
-- re-approval can never broadcast a second transfer.
alter table wallet_transfers
  drop constraint wallet_transfers_status_check;
alter table wallet_transfers
  add constraint wallet_transfers_status_check
  check (status in ('pending','submitting','submitted','denied','failed','submit_unknown'));
