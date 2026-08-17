import { describe, expect, it } from "vitest";
import {
  displayAmount,
  explorerTxUrl,
  projectTransaction,
} from "./project";

const WALLET = "0xAbC0000000000000000000000000000000000001";
const OTHER = "0xdef0000000000000000000000000000000000002";

function tx(overrides: Partial<Parameters<typeof projectTransaction>[2]> = {}) {
  return {
    hash: "0xhash",
    from_address: OTHER,
    to_address: WALLET,
    value: "1500000000000000000",
    block_timestamp: 1_700_000_000,
    ...overrides,
  };
}

describe("displayAmount", () => {
  it("formats whole and fractional units", () => {
    expect(displayAmount(1_500_000_000_000_000_000n, 18)).toBe("1.5");
    expect(displayAmount(2n * 10n ** 18n, 18)).toBe("2");
    expect(displayAmount(0n, 18)).toBe("0");
  });

  it("caps display at six decimal places", () => {
    expect(displayAmount(1n, 18)).toBe("0");
    expect(displayAmount(41_200_000_000_000_000n, 18)).toBe("0.0412");
  });
});

describe("explorerTxUrl", () => {
  it("uses Basescan for Base mainnet", () => {
    expect(explorerTxUrl(8453, "0xabc")).toBe("https://basescan.org/tx/0xabc");
  });

  it("falls back to a generic explorer for unknown chains", () => {
    expect(explorerTxUrl(424242, "0xabc")).toBe(
      "https://blockscan.com/tx/0xabc"
    );
  });
});

describe("projectTransaction", () => {
  it("marks inbound transfers and picks the sender as counterparty", () => {
    const projected = projectTransaction(WALLET, 8453, tx());
    expect(projected.direction).toBe("in");
    expect(projected.counterparty).toBe(OTHER);
    expect(projected.value_display).toBe("1.5");
    expect(projected.explorer_url).toBe("https://basescan.org/tx/0xhash");
    expect(projected.timestamp).toBe(
      new Date(1_700_000_000 * 1000).toISOString()
    );
  });

  it("marks outbound transfers case-insensitively", () => {
    const projected = projectTransaction(
      WALLET,
      8453,
      tx({ from_address: WALLET.toLowerCase(), to_address: OTHER })
    );
    expect(projected.direction).toBe("out");
    expect(projected.counterparty).toBe(OTHER);
  });

  it("tolerates a non-numeric value", () => {
    const projected = projectTransaction(WALLET, 8453, tx({ value: "bogus" }));
    expect(projected.value_display).toBe("0");
  });
});
