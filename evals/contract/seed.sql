-- Seed rows for the contract-eval lane (R-EV-07). One active user with a
-- dedicated iMessage line, an awake box pointing at the stub Hermes, a mail
-- inbox, a card in the vault, entitlements, and one chargeable merchant
-- (payee for the payment_request case). $EVAL_USER_ID is substituted by
-- lane.sh.

insert into users (id, status, username)
values (:'uid', 'active', 'evaluser');

-- The owner's own handle → trust tier 0 for the simulated inbound.
insert into handles (user_id, platform, address, verified_at)
values (:'uid', 'imessage', '+15555550199', now());

-- A chargeable off-platform payee for the payment_request case (F105).
insert into users (id, status, username)
values ('22222222-2222-3333-4444-555555555555', 'active', 'roaster');
insert into merchants (user_id, stripe_account_id, charges_enabled, details_submitted)
values ('22222222-2222-3333-4444-555555555555', 'acct_eval_roaster', true, true);

insert into provisioning (user_id, state, bound_phone)
values (:'uid', 'active', '+15555550199');

insert into lines (phone, role, mode, assigned_user_id, assigned_at)
values ('+15555550100', 'personal', 'dedicated', :'uid', now());

insert into entitlements (user_id) values (:'uid');

insert into boxes (
  user_id, provider, provider_box_id, state,
  hosted_url, hosted_token, api_server_key, gateway_token
) values (
  :'uid', 'ascii', 'bx_eval_contract', 'ready',
  'http://127.0.0.1:4470', 'eval-hosted-token', 'eval-api-server-key',
  'eval-gateway-token'
);

insert into agent_addresses (user_id, address, agentmail_pod_id, agentmail_inbox_id, is_primary)
values (:'uid', 'evaluser@wzrd.tech', 'pod-eval', 'inbox-eval', true);

insert into vault_items (id, user_id, kind, name, masked, env_var)
values ('33333333-2222-3333-4444-555555555555', :'uid', 'card', 'Visa ending 4242', '•••• 4242', 'AIR_VAULT_CARD_1');
