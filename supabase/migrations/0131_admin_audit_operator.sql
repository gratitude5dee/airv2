-- R-SEC-10: admin_audit rows name the human behind the shared
-- ADMIN_API_KEY. Every /api/admin route now requires the
-- X-Admin-Operator header (lib/admin/auth.ts); routes that write audit
-- rows record the value here. Rows written before this column existed
-- read 'unknown' — the name the audit trail genuinely cannot recover.

alter table admin_audit
  add column operator text not null default 'unknown';
