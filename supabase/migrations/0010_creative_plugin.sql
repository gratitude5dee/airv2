-- CM1 task 0 / V7 (CC10): the control plane persists the box dashboard's
-- basic-auth credential so the allowlisted proxy can reach dashboard (9119)
-- surfaces — specifically the creative plugin at /api/plugins/creative/*.
-- The value is AES-256-GCM ciphertext under BOX_DASHBOARD_AUTH_KEY, never
-- plaintext (see SECURITY-DECISIONS.md).

alter table boxes add column if not exists dashboard_auth text;
