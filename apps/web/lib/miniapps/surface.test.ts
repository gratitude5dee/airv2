/**
 * The card marker survives only into embedded webviews. A card link opened
 * in a real browser (Messages on a Mac hands links to Safari) renders full.
 */
import { describe, expect, it } from "vitest";
import { isFullBrowser, resolveVia } from "./surface";

const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MAC_FIREFOX =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0";
const IOS_MESSAGES_WEBVIEW =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36";

describe("isFullBrowser", () => {
  it("recognises desktop and mobile browsers", () => {
    for (const ua of [MAC_SAFARI, IOS_SAFARI, MAC_CHROME, MAC_FIREFOX]) {
      expect(isFullBrowser(ua)).toBe(true);
    }
  });

  it("keeps embedded webviews and unknown agents constrained", () => {
    expect(isFullBrowser(IOS_MESSAGES_WEBVIEW)).toBe(false);
    expect(isFullBrowser(ANDROID_WEBVIEW)).toBe(false);
    expect(isFullBrowser(null)).toBe(false);
    expect(isFullBrowser("")).toBe(false);
  });
});

describe("resolveVia", () => {
  it("drops the card marker in a full browser only", () => {
    expect(resolveVia("card", MAC_SAFARI)).toBeUndefined();
    expect(resolveVia("card", IOS_MESSAGES_WEBVIEW)).toBe("card");
    expect(resolveVia("card", null)).toBe("card");
  });

  it("never invents a card marker", () => {
    expect(resolveVia(undefined, IOS_MESSAGES_WEBVIEW)).toBeUndefined();
    expect(resolveVia(undefined, null)).toBeUndefined();
  });
});
