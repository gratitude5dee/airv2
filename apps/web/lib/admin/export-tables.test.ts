/**
 * V8 hardening item 3 — export completeness + safety. The manifest must
 * cover every wave table (room_members rides its rooms join in the route),
 * and no entry may export a sealed/credential column. PAN/CVV can never be
 * exported because C18 keeps them out of Postgres — the schema audit in
 * lib/security/c18-sweep.test.ts is the gate for that.
 */
import { describe, expect, it } from "vitest";
import { EXPORT_TABLES } from "./export-tables";
import { migrationSql, tableColumns, WAVE_TABLES } from "../security/c18";

const SECRET_COLUMN_RE = /(_sealed$|^api_server_key$|_token$|^gateway_token$)/;

describe("export manifest", () => {
  const manifest = new Map(EXPORT_TABLES.map((entry) => [entry.table, entry]));

  it("covers every wave table", () => {
    for (const table of WAVE_TABLES) {
      if (table === "room_members") continue; // exported via the rooms join
      expect(manifest.has(table), `export manifest missing ${table}`).toBe(
        true
      );
    }
  });

  it("never selects a sealed or credential column", () => {
    // tableColumns covers create-table blocks AND alter-add columns, so a
    // credential column added by a later migration is caught too.
    const tables = tableColumns(migrationSql());
    for (const entry of EXPORT_TABLES) {
      const declared = tables.get(entry.table);
      if (!declared) continue; // views/aliases have no create-table block
      const secretColumns = declared.filter((column) =>
        SECRET_COLUMN_RE.test(column)
      );
      if (entry.select === "*") {
        expect(
          secretColumns,
          `${entry.table} exports * but declares secret columns`
        ).toEqual([]);
      } else {
        for (const column of secretColumns) {
          expect(
            entry.select.split(",").map((part) => part.trim())
          ).not.toContain(column);
        }
      }
    }
  });

  it("bots and calendar_accounts use explicit column lists", () => {
    expect(manifest.get("bots")?.select).not.toBe("*");
    expect(manifest.get("calendar_accounts")?.select).not.toBe("*");
  });
});
