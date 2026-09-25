import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

vi.mock("../thirdweb/client", () => ({ sendWalletTokens: vi.fn() }));

import { sendWalletTokens } from "../thirdweb/client";
import {
  executeTransfer,
  parseAssetAmount,
  parseNativeAmount,
  shortAddress,
  transferIdempotencyKey,
  validateSendAddress,
  WalletSendError,
  WalletSubmitUnknownError,
  type WalletTransfer,
} from "./send";

describe("parseNativeAmount", () => {
  it("converts whole and fractional amounts to wei", () => {
    expect(parseNativeAmount("1")).toBe(10n ** 18n);
    expect(parseNativeAmount("0.5")).toBe(5n * 10n ** 17n);
    expect(parseNativeAmount("0.000000000000000001")).toBe(1n);
    expect(parseNativeAmount("12.25")).toBe(1225n * 10n ** 16n);
  });

  it("rejects zero, negatives, and malformed input", () => {
    expect(() => parseNativeAmount("0")).toThrow(WalletSendError);
    expect(() => parseNativeAmount("0.0")).toThrow(WalletSendError);
    expect(() => parseNativeAmount("-1")).toThrow(WalletSendError);
    expect(() => parseNativeAmount("")).toThrow(WalletSendError);
    expect(() => parseNativeAmount("1e18")).toThrow(WalletSendError);
    expect(() => parseNativeAmount("1.")).toThrow(WalletSendError);
    expect(() => parseNativeAmount(".5")).toThrow(WalletSendError);
    expect(() => parseNativeAmount("01")).toThrow(WalletSendError);
    // more than wei precision
    expect(() => parseNativeAmount("0.0000000000000000001")).toThrow(
      WalletSendError
    );
    // unbounded integer part
    expect(() => parseNativeAmount("1000000000")).toThrow(WalletSendError);
  });
});

describe("parseAssetAmount", () => {
  it("converts USDC amounts at 6 decimals", () => {
    expect(parseAssetAmount("1", 6)).toBe(1_000_000n);
    expect(parseAssetAmount("0.5", 6)).toBe(500_000n);
    expect(parseAssetAmount("0.000001", 6)).toBe(1n);
  });

  it("rejects more fraction digits than the asset carries", () => {
    expect(() => parseAssetAmount("0.0000001", 6)).toThrow(WalletSendError);
  });
});

describe("validateSendAddress", () => {
  it("accepts a checksummed 0x address and trims whitespace", () => {
    const addr = "0x52908400098527886E0F7030069857D2E4169EE7";
    expect(validateSendAddress(` ${addr} `)).toBe(addr);
  });

  it("rejects ENS names and malformed addresses — ENS is display-only", () => {
    expect(() => validateSendAddress("vitalik.eth")).toThrow(WalletSendError);
    expect(() => validateSendAddress("0x123")).toThrow(WalletSendError);
    expect(() => validateSendAddress("")).toThrow(WalletSendError);
    expect(() =>
      validateSendAddress("52908400098527886E0F7030069857D2E4169EE7")
    ).toThrow(WalletSendError);
    expect(() =>
      validateSendAddress("0xZZ908400098527886E0F7030069857D2E4169EE7")
    ).toThrow(WalletSendError);
  });
});

describe("shortAddress", () => {
  it("keeps the leading and trailing nibbles", () => {
    expect(shortAddress("0x52908400098527886E0F7030069857D2E4169EE7")).toBe(
      "0x5290…9EE7"
    );
  });
});

const TRANSFER: WalletTransfer = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  to_address: "0x52908400098527886E0F7030069857D2E4169EE7",
  amount_wei: "1000000000000000000",
  amount_display: "1",
  chain_id: 8453,
  token_address: null,
  token_symbol: "ETH",
  status: "pending",
  transaction_id: null,
  created_at: new Date().toISOString(),
  resolved_at: null,
};

const OWNER_WALLET = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";

const db = new FakeSupabase();

/** Seed one wallet_transfers row (a clone — the fake mutates rows in place)
 * plus the owner users row executeTransfer looks up. */
function seed(
  status: WalletTransfer["status"],
  walletAddress: string | null = OWNER_WALLET
) {
  db.tables["wallet_transfers"] = [
    { ...TRANSFER, status, transaction_id: null, resolved_at: null },
  ];
  if (walletAddress !== null) {
    db.tables["users"] = [{ id: TRANSFER.user_id, wallet_address: walletAddress }];
  }
}

function transferRow() {
  return db.rows("wallet_transfers")[0]!;
}

describe("executeTransfer", () => {
  const sendMock = vi.mocked(sendWalletTokens);

  beforeEach(() => {
    db.reset();
    sendMock.mockReset();
  });

  it("submits with an idempotency key derived from the transfer id", async () => {
    seed("pending");
    sendMock.mockResolvedValue(["tx-1"]);
    const txId = await executeTransfer(db.client(), "user-1", TRANSFER);
    expect(txId).toBe("tx-1");
    expect(sendMock).toHaveBeenCalledWith(
      OWNER_WALLET,
      TRANSFER.chain_id,
      TRANSFER.to_address,
      TRANSFER.amount_wei,
      null,
      transferIdempotencyKey(TRANSFER.id)
    );
    expect(transferRow()).toMatchObject({
      status: "submitted",
      transaction_id: "tx-1",
    });
  });

  it("passes the ERC-20 contract through for USDC transfers", async () => {
    seed("pending");
    sendMock.mockResolvedValue(["tx-2"]);
    const usdc = {
      ...TRANSFER,
      token_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      token_symbol: "USDC",
    };
    await executeTransfer(db.client(), "user-1", usdc);
    expect(sendMock).toHaveBeenCalledWith(
      expect.any(String),
      usdc.chain_id,
      usdc.to_address,
      usdc.amount_wei,
      usdc.token_address,
      transferIdempotencyKey(usdc.id)
    );
  });

  it("marks a submit throw terminal-unknown — never back to pending", async () => {
    seed("pending");
    sendMock.mockRejectedValue(new Error("socket hang up"));
    await expect(
      executeTransfer(db.client(), "user-1", TRANSFER)
    ).rejects.toBeInstanceOf(WalletSubmitUnknownError);
    expect(transferRow().status).toBe("submit_unknown");
    expect(transferRow().resolved_at).not.toBeNull();
    // A second approval can no longer claim the row — no re-broadcast.
    await expect(
      executeTransfer(db.client(), "user-1", TRANSFER)
    ).rejects.toMatchObject({ status: 409 });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("marks a submit without a transaction id terminal-unknown", async () => {
    seed("pending");
    sendMock.mockResolvedValue([]);
    await expect(
      executeTransfer(db.client(), "user-1", TRANSFER)
    ).rejects.toBeInstanceOf(WalletSubmitUnknownError);
    expect(transferRow().status).toBe("submit_unknown");
  });

  it("releases the claim to pending when no wallet is on file", async () => {
    seed("pending", null);
    await expect(
      executeTransfer(db.client(), "user-1", TRANSFER)
    ).rejects.toMatchObject({ status: 409, message: "no wallet on file" });
    expect(transferRow().status).toBe("pending");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects when the row is already claimed", async () => {
    seed("submitting");
    await expect(
      executeTransfer(db.client(), "user-1", TRANSFER)
    ).rejects.toMatchObject({ status: 409 });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
