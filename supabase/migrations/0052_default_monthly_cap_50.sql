-- Raise the default monthly inference cap for newly provisioned users to $50.
-- Existing rows were updated operator-side; this only changes the default.
alter table entitlements alter column monthly_cap_usd set default 50.00;
