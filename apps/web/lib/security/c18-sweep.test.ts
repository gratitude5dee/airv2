/**
 * V8 hardening item 1 — the C18 grep suite, CI-runnable form. Four surfaces:
 *
 *   1. Postgres schema audit: no migration declares a column that exists to
 *      hold a secret value, and every wave table carries `user_id uuid not
 *      null` (§9).
 *   2. Postgres row audit: representative rows for every wave table, built
 *      the way the routes build them from a fully-loaded fixture account,
 *      grepped for the planted values — zero hits.
 *   3. Vercel log fixture: a captured request-cycle log emitted through the
 *      scrubber shows zero planted values.
 *   4. SSE capture: a client-bound SSE transcript that a leak would have
 *      contaminated shows zero planted values after the scrubber.
 *
 * The production-shaped sweep (real box FS minus store.enc, live Vercel log
 * drain, real SSE captures from an account that exercised every V1–V6 path)
 * needs a live box — `scripts/c18-box-sweep.sh` is that runbook. This file
 * is the CI gate that the shapes those surfaces serialize stay value-free.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  auditColumnNames,
  findPlantedHits,
  migrationSql,
  parseCreateTables,
  tableColumns,
  WAVE_TABLES,
  WAVE_TABLES_WITHOUT_USER_ID,
} from "./c18";
import { amountBand } from "../vault/tickets";
import {
  registerVaultValue,
  resetRegisteredVaultValues,
  scrubVaultValues,
  vaultLog,
} from "../vault/scrub";

// Planted values — realistic shapes for every C18-protected class.
const PLANTED = {
  password: "hunter2-c18-planted-9dXw31QpZr",
  pan: "4929123456789012",
  cvv: "83521x",
  totpSeed: "JBSWY3DPEHPK3PXPC18PLANTED",
  apiKey: "sk-c18-planted-Zx98Yw76Vu54Ts32",
  noteBody: "the safe combination is 31-41-59 (c18 planted)",
} as const;

const PLANTED_VALUES = Object.values(PLANTED);

describe("C18 sweep — schema audit", () => {
  const sql = migrationSql();

  it("no migration declares a secret-value column", () => {
    expect(auditColumnNames(sql)).toEqual([]);
  });

  it("catches a secret column added via alter table", () => {
    const contaminated = `${sql}\nalter table vault_items add column pan text;`;
    expect(auditColumnNames(contaminated)).toEqual(["vault_items.pan"]);
  });

  it("catches alter-table spellings with schema/only/if exists", () => {
    for (const statement of [
      "alter table public.vault_items add column pan text;",
      "alter table only vault_items add column pan text;",
      "alter table if exists vault_items add column pan text;",
      "alter table if exists only public.vault_items add column if not exists pan text;",
    ]) {
      expect(auditColumnNames(`${sql}\n${statement}`), statement).toEqual([
        "vault_items.pan",
      ]);
    }
  });

  it("sees alter-added columns from the real migrations", () => {
    const columns = tableColumns(sql);
    expect(columns.get("boxes")).toContain("gateway_token");
    expect(columns.get("agent_runs")).toContain("schedule_source");
  });

  it("every wave table exists and carries user_id uuid not null (§9)", () => {
    const tables = new Map(
      parseCreateTables(sql).map((table) => [table.name, table])
    );
    for (const name of WAVE_TABLES) {
      const table = tables.get(name);
      expect(table, `missing wave table ${name}`).toBeDefined();
      if (
        (WAVE_TABLES_WITHOUT_USER_ID as readonly string[]).includes(name)
      ) {
        continue;
      }
      expect(table?.body, `${name} must carry user_id uuid not null`).toMatch(
        /user_id\s+uuid\s+not null/
      );
    }
  });

  it("vault_items may hold metadata only — no value column", () => {
    const vaultItems = parseCreateTables(sql).find(
      (table) => table.name === "vault_items"
    );
    expect(vaultItems).toBeDefined();
    // The full metadata vocabulary: ids, kind, name, masked tail, env var
    // name, a boolean, timestamps. Anything beyond this list is a review
    // conversation before it is a merge.
    expect(vaultItems?.columns.sort()).toEqual(
      [
        "id",
        "user_id",
        "kind",
        "name",
        "masked",
        "env_var",
        "totp_enabled",
        "created_at",
        "updated_at",
        "deleted_at",
      ].sort()
    );
  });
});

describe("C18 sweep — Postgres row audit", () => {
  it("representative wave-table rows built from a loaded account are value-free", () => {
    // Rows shaped exactly as the routes write them for an account that added
    // a login + card, minted and redeemed a fill ticket, scheduled, botted,
    // and sent from the wallet — with the planted secrets as the source
    // values. Only derived metadata may appear.
    const rows: Record<string, unknown> = {
      vault_items: {
        kind: "card",
        name: "Chase Sapphire",
        masked: `•••• ${PLANTED.pan.slice(-4)}`,
        env_var: null,
        totp_enabled: false,
      },
      vault_events: {
        action: "ticket_minted",
        context: `chase.com:${amountBand(842.5)}`,
      },
      fill_ticket_redemptions: {
        jti: "b1946ac92492d234",
        host: "chase.com",
        amount_band: amountBand(842.5),
      },
      decisions_purchase_review: {
        kind: "purchase_review",
        label: `Fill Chase Sapphire •••• ${PLANTED.pan.slice(-4)} on chase.com`,
        payload: {
          host: "chase.com",
          band: amountBand(842.5),
          card_masked: `•••• ${PLANTED.pan.slice(-4)}`,
        },
      },
      calendar_accounts: {
        provider: "calcom",
        external_ref: "cal_1234",
        webhook_secret_sealed: "aes256gcm:9f8e7d6c…",
      },
      agent_schedules: {
        cron: "0 9 * * 1-5",
        prompt_ref: ".hermes/schedules/sched-1.md",
        deliver: "none",
        source: "computer",
      },
      automation_rules: { platform: "instagram", daily_cap: 25, used_today: 3 },
      bots: { name: "researcher", status: "ready" },
      wallet_transfers: {
        to_address: "0x1111111111111111111111111111111111111111",
        amount_wei: "1000000000000000000",
        amount_display: "1 ETH",
        status: "submitted",
      },
      box_state_events: { state: "ready" },
    };
    expect(findPlantedHits(JSON.stringify(rows), PLANTED_VALUES)).toEqual([]);
  });

  it("the harness itself detects a contaminated row dump", () => {
    const leaked = JSON.stringify({ vault_items: { name: PLANTED.password } });
    expect(findPlantedHits(leaked, PLANTED_VALUES)).toEqual([
      PLANTED.password,
    ]);
  });
});

describe("C18 sweep — Vercel log fixture", () => {
  const captured: string[] = [];

  beforeEach(() => {
    captured.length = 0;
    resetRegisteredVaultValues();
    for (const value of PLANTED_VALUES) registerVaultValue(value);
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      captured.push(String(line));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRegisteredVaultValues();
  });

  it("a request-cycle log that touched vault values shows zero hits", () => {
    // Worst case: a code path logs the whole payload. The scrubber is the
    // belt to the "ids only" suspenders — the fixture must still be clean.
    vaultLog({ msg: "vault apply", item: "itm_1", fields: PLANTED });
    vaultLog({ msg: "fill ticket minted", host: "chase.com", jti: "abc123" });
    const fixture = captured.join("\n");
    expect(fixture.length).toBeGreaterThan(0);
    expect(findPlantedHits(fixture, PLANTED_VALUES)).toEqual([]);
    expect(fixture).toContain("[REDACTED]");
  });
});

describe("C18 sweep — SSE capture", () => {
  beforeEach(() => {
    resetRegisteredVaultValues();
    for (const value of PLANTED_VALUES) registerVaultValue(value);
  });

  afterEach(() => {
    resetRegisteredVaultValues();
  });

  it("a client-bound SSE transcript is scrubbed to zero hits", () => {
    // Simulates the red-team run that echoes injected values back through
    // the event stream: the capture must show [REDACTED], never the value.
    const sse = [
      `data: {"delta":"your password is ${PLANTED.password}"}`,
      `data: {"delta":"card ${PLANTED.pan} cvv ${PLANTED.cvv}"}`,
      "data: [DONE]",
    ].join("\n\n");
    expect(findPlantedHits(sse, PLANTED_VALUES)).not.toEqual([]);
    const scrubbed = scrubVaultValues(sse);
    expect(findPlantedHits(scrubbed, PLANTED_VALUES)).toEqual([]);
    expect(scrubbed).toContain("[REDACTED]");
  });
});
