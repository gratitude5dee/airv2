/**
 * V8 hardening item 3 — the export manifest. One entry per user-keyed
 * metadata table; a table with a sealed/secret column exports an explicit
 * column list instead of `*` so no credential ever rides the archive (and
 * no PAN/CVV can — C18 keeps those out of Postgres entirely; the user's
 * plaintext vault export is the `air-vault export --json` run they trigger
 * from the Vault tab, delivered as a download, never stored).
 */

export interface ExportTable {
  table: string;
  /** Column that scopes rows to the user. */
  column: "id" | "user_id" | "owner_user_id" | "created_by";
  /** Explicit select list; "*" only when the table holds no secret column. */
  select: string;
}

const all = (table: string): ExportTable => ({
  table,
  column: table === "users" ? "id" : "user_id",
  select: "*",
});

export const EXPORT_TABLES: readonly ExportTable[] = [
  // v2 core (M8)
  all("users"),
  all("handles"),
  all("senders"),
  all("agent_addresses"),
  all("entitlements"),
  all("provisioning"),
  all("inbound_events"),
  all("connections"),
  all("agent_runs"),
  all("decisions"),
  all("miniapp_redemptions"),
  // creative/social/ads wave
  all("brand_kits"),
  { table: "creative_assets", column: "user_id", select: "*" },
  all("content_slots"),
  all("automation_rules"),
  // V1/V2 vault — metadata only by construction (C18)
  all("vault_items"),
  all("vault_events"),
  all("vault_managers"),
  // V3/V4 calendar spine — webhook secret stays sealed and stays home
  {
    table: "calendar_accounts",
    column: "user_id",
    select:
      "id, provider, label, external_ref, status, last_synced_at, created_at",
  },
  all("agent_schedules"),
  all("calendar_moments"),
  all("card_sends"),
  all("miniapp_card_sessions"),
  // V6 shopping fill ledger — jti/host/band only
  all("fill_ticket_redemptions"),
  // V7 bots — the per-profile API key never leaves the control plane
  {
    table: "bots",
    column: "user_id",
    select:
      "id, name, title, description, avatar_kind, avatar_ref, model_tier, status, group_label, created_at",
  },
  all("rooms"),
  // V8 tabs
  all("wallet_transfers"),
  all("box_state_events"),
  // V9 mini-apps (MA11) — password_hash never leaves the server, plugin
  // bearer/device-code hashes stay home; x402_receipts is app-keyed and
  // exported by the route through the user's owned app ids.
  {
    table: "mini_apps",
    column: "owner_user_id",
    select:
      "id, slug, route, kind, scopes, backing_tool, name, description, icon_key, " +
      "publisher_username, publisher_wallet, agent_identity, visibility, access, " +
      "x402_enabled, x402_price_usdc, x402_config, plugin_signin_enabled, status, " +
      "bundle_version, listed_at, updated_at, " +
      "appname, draft_version, lane, functions_enabled, kit_version, create_budget_usd",
  },
  // V11 Create — version metadata is digests and sizes (CR5); Functions
  // holds names/ids only; runtime tokens export as issuance dates, never the
  // hash.
  all("miniapp_versions"),
  all("miniapp_functions"),
  {
    table: "miniapp_runtime_tokens",
    column: "user_id",
    select: "id, app_id, created_at, revoked_at",
  },
  all("miniapp_installs"),
  { table: "miniapp_guest_grants", column: "created_by", select: "*" },
  all("miniapp_gate_events"),
  all("user_buckets"),
  {
    table: "plugin_tokens",
    column: "user_id",
    select: "id, tool, created_at, last_used_at, revoked_at",
  },
  {
    table: "plugin_device_codes",
    column: "user_id",
    select: "id, tool, status, created_at, expires_at, approved_at",
  },
  all("pending_uploads"),
  // MA8 commerce — stripe_account_id is the merchant's own Connect account
  // reference, not a credential.
  all("merchants"),
  all("storefront_products"),
  all("orders"),
  all("payment_requests"),
  all("storefront_events"),
  all("ops_events"),
] as const;
