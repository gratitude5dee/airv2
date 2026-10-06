/**
 * MA5 owner pass-through (R-LOGS-02): a valid `mini_store` session whose user
 * is the app's owner acts as an owner MiniSession anywhere the store session
 * exists — the same cookie that logs them into the store lets their own
 * live/draft apps render without a signed card link. Anyone else's store
 * session, a missing cookie, or an ownerless app gains nothing.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { makeApp } from "@/app/mini/loader-test-utils";
import { ownerSessionFromStore } from "./gates";
import { mintStoreSessionToken, STORE_COOKIE } from "./storeSession";

function request(userId?: string): NextRequest {
  const headers = new Headers();
  if (userId) {
    headers.set("cookie", `${STORE_COOKIE}=${mintStoreSessionToken(userId)}`);
  }
  return new NextRequest("https://mini.example/alice/notes", { headers });
}

beforeEach(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
});

describe("ownerSessionFromStore", () => {
  const app = makeApp({ slug: "alice-notes", owner_user_id: "user-alice" });

  it("admits the owner's store session as an owner MiniSession", () => {
    const session = ownerSessionFromStore(request("user-alice"), app);
    expect(session).toEqual({
      userId: "user-alice",
      resourceId: "default",
      role: "owner",
    });
  });

  it("rejects a store session for a different user", () => {
    expect(ownerSessionFromStore(request("user-bob"), app)).toBeNull();
  });

  it("rejects when no store cookie is present", () => {
    expect(ownerSessionFromStore(request(), app)).toBeNull();
  });

  it("rejects a forged cookie", () => {
    const forged = new NextRequest("https://mini.example/alice/notes", {
      headers: new Headers({ cookie: `${STORE_COOKIE}=bogus` }),
    });
    expect(ownerSessionFromStore(forged, app)).toBeNull();
  });

  it("rejects apps with no owner", () => {
    const ownerless = makeApp({ slug: "pub-app", owner_user_id: null });
    expect(ownerSessionFromStore(request("user-alice"), ownerless)).toBeNull();
  });
});
