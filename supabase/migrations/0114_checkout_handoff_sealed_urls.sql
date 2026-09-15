-- Credential-bearing cart/session URLs are sensitive capabilities. Keep only
-- the public merchant origin in ordinary metadata and store the full URL as
-- control-plane AES-GCM ciphertext. Existing rows remain readable through the
-- legacy merchant_url fallback and can expire naturally.
alter table checkout_handoffs
  add column if not exists merchant_url_sealed text,
  add column if not exists human_control_expires_at timestamptz,
  add column if not exists human_control_returned_at timestamptz;

comment on column checkout_handoffs.merchant_url is
  'Public merchant origin for display/fail-closed fallback; new full cart URLs are sealed.';
comment on column checkout_handoffs.merchant_url_sealed is
  'AES-GCM sealed full checkout URL; service-role only and never exported.';
comment on column checkout_handoffs.human_control_expires_at is
  'Bounded owner-control lease; agents must not drive the shared browser while active.';
comment on column checkout_handoffs.human_control_returned_at is
  'Explicit owner return marker that ends the browser-control lease immediately.';
