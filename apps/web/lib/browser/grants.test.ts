/**
 * V5 site grants: default deny on missing/malformed files, host
 * normalization, and grant writes that carry only item ids + hostnames.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, writeFile } from "../box/client";
import {
  SITE_GRANTS_RELATIVE,
  normalizeHost,
  parseSiteGrants,
  readSiteGrants,
  setSiteGrant,
} from "./grants";

vi.mock("../box/client", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  command: vi.fn(),
}));

afterEach(() => {
  vi.mocked(readFile).mockReset();
  vi.mocked(writeFile).mockReset();
});

describe("normalizeHost", () => {
  it("lowercases, strips www and extracts hostnames from URLs", () => {
    expect(normalizeHost("WWW.GitHub.com")).toBe("github.com");
    expect(normalizeHost("https://www.instagram.com/p/abc")).toBe(
      "instagram.com"
    );
    expect(normalizeHost("x.com:443/home")).toBe("x.com");
  });

  it("rejects garbage and bare words", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost("not a host")).toBeNull();
    expect(normalizeHost("localhost")).toBeNull();
  });
});

describe("parseSiteGrants — default deny", () => {
  it("reads malformed content as no grants", () => {
    expect(parseSiteGrants("not json")).toEqual({});
    expect(parseSiteGrants("null")).toEqual({});
    expect(parseSiteGrants('{"grants": 7}')).toEqual({});
    expect(parseSiteGrants('{"grants": {"item": "x.com"}}')).toEqual({});
  });

  it("keeps only string hosts", () => {
    expect(
      parseSiteGrants('{"grants": {"item": ["x.com", 5, null]}}')
    ).toEqual({ item: ["x.com"] });
  });
});

describe("readSiteGrants", () => {
  it("defaults to deny when the file does not exist", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("no such file"));
    expect(await readSiteGrants("box-1")).toEqual({});
  });
});

describe("setSiteGrant", () => {
  it("writes ids and hostnames only — never values — to the home-relative files-API path", async () => {
    vi.mocked(readFile).mockResolvedValue('{"version":1,"grants":{}}');
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const grants = await setSiteGrant(
      "box-1",
      "itm-1",
      "https://www.github.com/login",
      true
    );
    expect(grants).toEqual({ "itm-1": ["github.com"] });
    const [boxId, path, content] = vi.mocked(writeFile).mock.calls[0]!;
    expect(boxId).toBe("box-1");
    expect(path).toBe(SITE_GRANTS_RELATIVE);
    expect(JSON.parse(content)).toEqual({
      version: 1,
      grants: { "itm-1": ["github.com"] },
    });
  });

  it("revoking the last host removes the item entry", async () => {
    vi.mocked(readFile).mockResolvedValue(
      '{"version":1,"grants":{"itm-1":["github.com"]}}'
    );
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const grants = await setSiteGrant("box-1", "itm-1", "github.com", false);
    expect(grants).toEqual({});
  });

  it("refuses invalid hosts", async () => {
    await expect(
      setSiteGrant("box-1", "itm-1", "not a host", true)
    ).rejects.toThrow("invalid host");
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
  });
});
