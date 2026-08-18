/**
 * V8 hardening: the C18 sweep harness. C18 says no secret value — password,
 * PAN, CVV, TOTP seed, API key, note body — ever lands in Postgres, a Vercel
 * log line, a mini-app URL, run metadata, or an analytics event. The harness
 * gives every sweep surface (row dumps, log fixtures, SSE captures, box FS
 * scans) one grep primitive and gives CI a schema-level audit of the
 * migrations so a value-shaped column cannot land in Postgres unnoticed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MIGRATIONS_DIR = join(
  __dirname,
  "../../../../supabase/migrations"
);

/** Concatenated migration SQL, lowercased, in apply order. */
export function migrationSql(dir: string = MIGRATIONS_DIR): string {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(dir, file), "utf8"))
    .join("\n")
    .toLowerCase();
}

/**
 * Grep a sweep surface (a serialized row dump, a captured log fixture, an
 * SSE transcript) for planted secret values. Returns the planted values that
 * appear — the sweep passes on an empty result.
 */
export function findPlantedHits(
  text: string,
  planted: readonly string[]
): string[] {
  return planted.filter((value) => value.length > 0 && text.includes(value));
}

/** One `create table` block, as declared in a migration. */
export interface TableDeclaration {
  name: string;
  body: string;
  columns: string[];
}

/** Every `create table` in the migration set, with parsed column names. */
export function parseCreateTables(sql: string): TableDeclaration[] {
  const tables: TableDeclaration[] = [];
  const re = /create table\s+([a-z0-9_]+)\s*\(([\s\S]*?)\n\);/g;
  for (let match = re.exec(sql); match; match = re.exec(sql)) {
    const [, name = "", body = ""] = match;
    const columns: string[] = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (
        line.startsWith("--") ||
        line.startsWith("primary key") ||
        line.startsWith("unique") ||
        line.startsWith("check") ||
        line.startsWith("constraint") ||
        line.startsWith("foreign key")
      ) {
        continue;
      }
      const column = /^([a-z0-9_]+)\s/.exec(line)?.[1];
      if (column) columns.push(column);
    }
    tables.push({ name, body, columns });
  }
  return tables;
}

/**
 * Column names that would only exist to hold a C18-protected value. The
 * audit is name-based (the row audit covers values): a column named like a
 * PAN/CVV/password/TOTP-seed/plaintext-secret holder fails the sweep.
 * `*_sealed` columns (AES-256-GCM via lib/crypto/secretbox, e.g.
 * `webhook_secret_sealed`) and boolean flags (`totp_enabled`) are the
 * deliberate exceptions.
 */
const FORBIDDEN_COLUMN_RE =
  /^(pan|cvv|cvc|card_number|password|passphrase|totp_seed|otp_seed|private_key|seed_phrase|mnemonic|plaintext.*|secret|secret_value)$/;

/** Audit every declared column name; returns `table.column` violations. */
export function auditColumnNames(sql: string): string[] {
  const violations: string[] = [];
  for (const table of parseCreateTables(sql)) {
    for (const column of table.columns) {
      if (FORBIDDEN_COLUMN_RE.test(column)) {
        violations.push(`${table.name}.${column}`);
      }
    }
  }
  return violations;
}

/**
 * Tables introduced by this wave (migrations 0022+). §9: `user_id uuid not
 * null` on any new table — `room_members` is the one deliberate exception
 * (a join table reaped through rooms(id)/bots(id) cascades).
 */
export const WAVE_TABLES = [
  "vault_items",
  "vault_events",
  "calendar_accounts",
  "agent_schedules",
  "card_sends",
  "automation_rules",
  "vault_managers",
  "bots",
  "rooms",
  "room_members",
  "fill_ticket_redemptions",
  "wallet_transfers",
  "box_state_events",
] as const;

export const WAVE_TABLES_WITHOUT_USER_ID = ["room_members"] as const;
