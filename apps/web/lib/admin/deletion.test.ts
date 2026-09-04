/**
 * Admin-delete checklist: user deletion relies on `on delete cascade` from
 * users(id) to reap every per-user table. This asserts the invariant against
 * the migrations themselves — any new per-user table (bots, rooms, …) that
 * references users(id) without cascade would orphan rows the moment an admin
 * deletes the user.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname, "../../../../supabase/migrations");

function migrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

describe("migration ledger", () => {
  it("every migration has a unique numeric version prefix", () => {
    // Supabase Branching keys schema_migrations by the numeric prefix alone;
    // two files sharing one (e.g. 0082_a.sql + 0082_b.sql) fail every branch
    // deploy with a duplicate-key error even though apply-migrations.sh,
    // which tracks by filename, is happy.
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const versions = files.map((f) => f.split("_")[0]);
    for (const version of versions) expect(version).toMatch(/^\d{4}$/);
    expect(new Set(versions).size).toBe(files.length);
  });
});

describe("deletion checklist (no orphan rows after user delete)", () => {
  const sql = migrationSql().toLowerCase();

  it("every users(id) reference declares an on-delete action", () => {
    // cascade reaps the row; set null is the deliberate exception for rows
    // that outlive their user (e.g. released inventory). A bare reference
    // would make user deletion fail or orphan rows.
    const references = sql.match(/references\s+users\s*\(id\)[^,)]*/g) ?? [];
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference).toMatch(/on delete (cascade|set null)/);
    }
  });

  it("bots rows cascade with the user (V7)", () => {
    const bots = /create table bots[\s\S]*?\);/.exec(sql)?.[0] ?? "";
    expect(bots).toContain("references users(id) on delete cascade");
  });

  it("rooms and room_members cascade with the user/bot (V7)", () => {
    const rooms = /create table rooms[\s\S]*?\);/.exec(sql)?.[0] ?? "";
    expect(rooms).toContain("references users(id) on delete cascade");
    const members = /create table room_members[\s\S]*?\);/.exec(sql)?.[0] ?? "";
    expect(members).toContain("references rooms(id) on delete cascade");
    expect(members).toContain("references bots(id) on delete cascade");
  });
});
