/**
 * V1 task 6 — log-scrubber CI gate. A full request cycle (apply → list →
 * reveal → totp) runs with planted vault values while every console line is
 * captured into a fixture; the gate greps the fixture for the planted values
 * and blocks merge on any hit. It also asserts the scrubber itself masks a
 * hypothetical leak, since the scrubber is the belt to the "ids only"
 * suspenders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { command, writeFile } from "../box/client";
import { serviceClient } from "../supabase";
import { applyBatch, listItems, reveal, totp } from "./client";
import {
  registerVaultValue,
  resetRegisteredVaultValues,
  scrubVaultValues,
  unregisterVaultValues,
  vaultLog,
} from "./scrub";

vi.mock("../box/client", () => ({ command: vi.fn(), writeFile: vi.fn() }));
vi.mock("../supabase", () => ({ serviceClient: vi.fn() }));

// Planted values: realistic shapes for a password, an API key, a card
// PAN/CVV, and a TOTP seed.
const PLANTED = {
  password: "hunter2-vault-planted-8fKq21LmXw",
  apiKey: "sk-vault-planted-Ab12Cd34Ef56Gh78",
  pan: "4111111111111111",
  cvv: "94321x",
  totpSeed: "JBSWY3DPEHPK3PXPVAULTPLANTED",
} as const;

function cliOk(stdout: string) {
  return { exitCode: 0, stdout, stderr: "" };
}

const fakeSupabase = {
  from: () => ({
    insert: () => Promise.resolve({ error: null }),
    upsert: () => Promise.resolve({ error: null }),
    update: () => ({
      eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
};

describe("log-scrubber gate (V1 task 6)", () => {
  let fixture: string[];

  beforeEach(() => {
    fixture = [];
    resetRegisteredVaultValues();
    vi.mocked(serviceClient).mockReturnValue(
      fakeSupabase as unknown as ReturnType<typeof serviceClient>
    );
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      fixture.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      fixture.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      fixture.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(command).mockReset();
    vi.mocked(writeFile).mockReset();
  });

  it("captured request-cycle log fixture contains zero planted-value hits", async () => {
    // --- apply: create a login (password + TOTP seed), an API key, a card ---
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(command)
      .mockResolvedValueOnce(cliOk("")) // mkdir inbox
      .mockResolvedValueOnce(
        cliOk(
          JSON.stringify({
            ok: true,
            results: [
              {
                op: "create",
                id: "item-login",
                status: "created",
                item: {
                  id: "item-login",
                  kind: "login",
                  name: "Example",
                  masked: "hu……Xw",
                  env_var: null,
                  totp_enabled: true,
                  created_at: null,
                  updated_at: null,
                },
              },
              {
                op: "create",
                id: "item-key",
                status: "created",
                item: {
                  id: "item-key",
                  kind: "api_key",
                  name: "OpenAI",
                  masked: "sk-…h78",
                  env_var: "PLANTED_KEY",
                  totp_enabled: false,
                  created_at: null,
                  updated_at: null,
                },
              },
              {
                op: "create",
                id: "item-card",
                status: "created",
                item: {
                  id: "item-card",
                  kind: "card",
                  name: "Visa",
                  masked: "•••• 1111",
                  env_var: null,
                  totp_enabled: false,
                  created_at: null,
                  updated_at: null,
                },
              },
            ],
          })
        )
      )
      // --- list ---
      .mockResolvedValueOnce(
        cliOk(JSON.stringify({ version: 1, items: [] }))
      )
      // --- reveal password / totp code ---
      .mockResolvedValueOnce(cliOk(PLANTED.password))
      .mockResolvedValueOnce(cliOk("123456\n"));

    await applyBatch("bx_1", "user-1", [
      {
        op: "create",
        item: {
          kind: "login",
          name: "Example",
          fields: { username: "me@example.com", password: PLANTED.password },
          totp_seed: PLANTED.totpSeed,
        },
      },
      {
        op: "create",
        item: {
          kind: "api_key",
          name: "OpenAI",
          fields: { key: PLANTED.apiKey },
          env_var: "PLANTED_KEY",
        },
      },
      {
        op: "create",
        item: {
          kind: "card",
          name: "Visa",
          fields: { number: PLANTED.pan, cvv: PLANTED.cvv },
        },
      },
    ]);
    await listItems("bx_1");
    await reveal("bx_1", "user-1", "item-login", "password", "web");
    await totp("bx_1", "user-1", "item-login");

    // The gate: grep the captured fixture for every planted value.
    const log = fixture.join("\n");
    expect(log.length).toBeGreaterThan(0);
    for (const [label, value] of Object.entries(PLANTED)) {
      const hits = log.split(value).length - 1;
      expect(hits, `planted ${label} leaked into logs`).toBe(0);
    }
  });

  it("the scrubber masks registered values if a leak does happen", () => {
    registerVaultValue(PLANTED.password);
    vaultLog({ msg: "oops", detail: `value=${PLANTED.password}` });
    const line = fixture.join("\n");
    expect(line).not.toContain(PLANTED.password);
    expect(line).toContain("[REDACTED]");
  });

  it("registration is bounded to the operation that carried the value", async () => {
    // After the request cycle in the gate test above, applyBatch/reveal have
    // unregistered their values — nothing is retained process-wide.
    vi.mocked(command).mockResolvedValue(cliOk(PLANTED.password));
    await reveal("bx_1", "user-1", "item-login", "password");
    expect(scrubVaultValues(`v=${PLANTED.password}`)).toContain(
      PLANTED.password
    );
  });

  it("unregisterVaultValues drops values from the registry", () => {
    registerVaultValue(PLANTED.apiKey);
    unregisterVaultValues([PLANTED.apiKey]);
    expect(scrubVaultValues(`k=${PLANTED.apiKey}`)).toContain(PLANTED.apiKey);
  });

  it("scrubVaultValues replaces every occurrence, including embedded ones", () => {
    registerVaultValue(PLANTED.apiKey);
    const scrubbed = scrubVaultValues(
      `a=${PLANTED.apiKey} b="${PLANTED.apiKey}" c=x${PLANTED.apiKey}y`
    );
    expect(scrubbed).not.toContain(PLANTED.apiKey);
    expect(scrubbed.split("[REDACTED]").length - 1).toBe(3);
  });
});
