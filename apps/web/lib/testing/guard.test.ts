import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { FakeSupabase } from "./fakeSupabase";

/**
 * R-TQ-01 guard: no test file may define its own supabase `from()` chain —
 * the shared FakeSupabase is the only fake. A file that needs a supabase
 * client migrates to `new FakeSupabase()` instead of hand-rolling a mock
 * whose `from()` returns a fixed chain regardless of table or filters.
 */
const OWN_FROM = new RegExp(
  [
    String.raw`from\s*:\s*(async\s*)?(\(|function|vi\.|[a-zA-Z_$][\w$]*\s*=>)`,
    String.raw`(?<![.\w$])from\s*\([^"'][^)]*\)\s*\{`,
  ].join("|")
);

function* testFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
        yield* testFiles(path);
      }
    } else if (entry.name.endsWith(".test.ts")) {
      yield path;
    }
  }
}

describe("no test file defines its own from() chain", () => {
  const root = join(__dirname, "..", "..");
  it("passes the repo-wide scan", () => {
    const offenders: string[] = [];
    for (const file of testFiles(root)) {
      const rel = relative(root, file);
      if (rel === join("lib", "testing", "guard.test.ts")) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      for (const [i, line] of lines.entries()) {
        if (OWN_FROM.test(line)) offenders.push(`${rel}:${i + 1}`);
      }
    }
    expect(offenders, `hand-rolled from() chains — migrate to FakeSupabase:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("FakeSupabase query surface (R-TQ-01)", () => {
  it("upserts, rpcs, not/order/limit, maybeSingle, expectQuery", async () => {
    const db = new FakeSupabase();
    db.tables["t"] = [
      { id: 1, name: "a", n: 2, gone: null },
      { id: 2, name: "b", n: 5, gone: null },
      { id: 3, name: "c", n: 1, gone: "x" },
    ];
    const c = db.client();

    const { data: upserted } = await c.from("t").upsert({ id: 1, name: "a2", n: 9 });
    expect(upserted).toBeNull();
    expect(db.upserts).toEqual([{ table: "t", row: { id: 1, name: "a2", n: 9 } }]);
    expect(db.rows("t").find((r) => r["id"] === 1)?.["name"]).toBe("a2");

    db.rpcResults["double_it"] = (args: unknown) => (args as { n: number }).n * 2;
    const { data: rpcData } = await c.rpc("double_it", { n: 21 });
    expect(rpcData).toBe(42);
    expect(db.rpcCalls[0]?.fn).toBe("double_it");

    const { data: filtered } = await c
      .from("t")
      .select("name")
      .not("gone", "is", null)
      .order("n", { ascending: false })
      .limit(1);
    expect(filtered).toEqual([{ name: "c" }]);

    const { data: maybe } = await c.from("t").select("name").eq("id", 999).maybeSingle();
    expect(maybe).toBeNull();
    const { data: single, error: singleErr } = await c.from("t").select("name").eq("id", 2).single();
    expect(single).toEqual({ name: "b" });
    expect(singleErr).toBeNull();
    const { error: multiErr } = await c.from("t").select("name").neq("id", 999).single();
    expect(multiErr?.code).toBe("PGRST116");

    db.expectQuery({ table: "t", filters: [{ op: "not.is", column: "gone", value: null }] });
    db.expectQuery({ table: "t", filters: [{ op: "eq", column: "id", value: 999 }] });
  });
});
