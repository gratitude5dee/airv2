import { describe, expect, it } from "vitest";
import {
  parseNativeAmount,
  shortAddress,
  validateSendAddress,
  WalletSendError,
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
