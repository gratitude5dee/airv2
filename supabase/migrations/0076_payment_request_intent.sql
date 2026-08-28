-- Hosted approval page (Express Checkout Element): a wallet confirmation
-- pays through a direct-charge PaymentIntent on the payee merchant's
-- connected account instead of a redirect Checkout session. The intent id
-- is recorded so the payment_intent.succeeded webhook can flip the request
-- to paid — the same replay-safe conditional-flip discipline as the
-- Checkout-session lane (stripe_session_id).
-- Forward-only and idempotent.

alter table payment_requests
  add column if not exists stripe_payment_intent_id text;

create index if not exists payment_requests_intent_idx
  on payment_requests (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
