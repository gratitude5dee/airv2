import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import {
  APPNAME_RE,
  USERNAME_RE,
  appOriginHost,
  joinPublishedSlug,
  nestedPathFor,
  parseNestedPath,
  splitPublishedSlug,
} from "./nested";
import { RESERVED_WORDS, isReservedWord } from "./reserved";

describe("V11 §6 slug split", () => {
  it("splits at the first hyphen — usernames never contain one", () => {
    expect(splitPublishedSlug("alice-notes")).toEqual({
      username: "alice",
      appname: "notes",
    });
    expect(splitPublishedSlug("alice_1-my-notes-2")).toEqual({
      username: "alice_1",
      appname: "my-notes-2",
    });
    expect(joinPublishedSlug("alice", "my-notes")).toBe("alice-my-notes");
  });

  it("rejects bare, malformed, and reserved-prefixed slugs", () => {
    expect(splitPublishedSlug("kanban")).toBeNull();
    expect(splitPublishedSlug("-notes")).toBeNull();
    expect(splitPublishedSlug("alice-")).toBeNull();
    expect(splitPublishedSlug("a-notes")).toBeNull(); // username too short
    expect(splitPublishedSlug("alice-notes_v2")).toBeNull(); // underscore in appname
    expect(splitPublishedSlug("store-notes")).toBeNull(); // reserved (CR15)
    expect(splitPublishedSlug("api-notes")).toBeNull();
    expect(splitPublishedSlug(`alice-${"a".repeat(33)}`)).toBeNull();
    expect(splitPublishedSlug(`alice-${"a".repeat(32)}`)).not.toBeNull();
  });

  it("username and appname alphabets are disjoint on the separator", () => {
    expect(USERNAME_RE.test("al-ice")).toBe(false);
    expect(APPNAME_RE.test("my_app")).toBe(false);
    expect(APPNAME_RE.test("-lead")).toBe(false);
    expect(APPNAME_RE.test("trail-")).toBe(false);
  });

  it("canonical path is nested for published, flat for first-party", () => {
    expect(nestedPathFor("alice-notes")).toBe("/alice/notes");
    expect(nestedPathFor("kanban")).toBe("/kanban");
    expect(appOriginHost("alice-notes", "apps.wzrd.tech")).toBe(
      "alice-notes.apps.wzrd.tech"
    );
  });
});

describe("V11 CR15 reserved words", () => {
  it("covers every first segment the mini origin routes itself", () => {
    for (const word of [
      "store", "create", "login", "api", "_next", "mini", "u", "app", "apps",
      "functions", "drop", "preview", "publish", "admin", "www",
    ]) {
      if (word === "u") continue; // rewritten publisher prefix is internal only
      expect(isReservedWord(word), word).toBe(true);
    }
  });

  it("covers every first-party slug", () => {
    for (const slug of ["kanban", "todo", "vault", "browser", "inbox", "pay"]) {
      expect(isReservedWord(slug), slug).toBe(true);
    }
  });

  it("is case/whitespace insensitive and never lets a reserved word route as a publisher", () => {
    expect(isReservedWord(" Store ")).toBe(true);
    for (const word of RESERVED_WORDS) {
      expect(parseNestedPath(`/${word}`)).toBeNull();
      expect(parseNestedPath(`/${word}/notes`)).toBeNull();
    }
  });
});

describe("parseNestedPath", () => {
  it("classifies publisher, app, detail, and asset paths", () => {
    expect(parseNestedPath("/alice")).toEqual({
      kind: "publisher",
      username: "alice",
    });
    expect(parseNestedPath("/alice/notes")).toEqual({
      kind: "app",
      username: "alice",
      appname: "notes",
      slug: "alice-notes",
      rest: "",
    });
    expect(parseNestedPath("/alice/notes/store")).toEqual({
      kind: "detail",
      username: "alice",
      appname: "notes",
      slug: "alice-notes",
    });
    expect(parseNestedPath("/alice/notes/app.js")).toMatchObject({
      kind: "app",
      slug: "alice-notes",
      rest: "/app.js",
    });
  });

  it("returns null for first-party and malformed paths", () => {
    expect(parseNestedPath("/kanban")).toBeNull();
    expect(parseNestedPath("/alice/My_App")).toBeNull();
    expect(parseNestedPath("/")).toBeNull();
  });
});

const mini = (path: string, headers: Record<string, string> = {}) =>
  middleware(
    new NextRequest(`https://mini.wzrd.tech${path}`, {
      headers: { host: "mini.wzrd.tech", ...headers },
    })
  );

describe("middleware nested routing (V11 §6)", () => {
  it("rewrites /<u>/<a> to the flat loader and marks it nested", () => {
    const res = mini("/alice/notes?x=1");
    const rewrite = res.headers.get("x-middleware-rewrite") ?? "";
    expect(rewrite).toContain("/mini/alice-notes?x=1");
    expect(res.headers.get("x-middleware-request-x-mini-nested")).toBe("1");
    expect(res.headers.get("x-middleware-request-x-mini-host")).toBe("1");
  });

  it("rewrites nested asset paths under the flat slug", () => {
    const res = mini("/alice/notes/app.js");
    expect(res.headers.get("x-middleware-rewrite") ?? "").toContain(
      "/mini/alice-notes/app.js"
    );
  });

  it("301s the flat legacy URL to the nested one, keeping ?t=", () => {
    const res = mini("/alice-notes?t=abc.def&via=card");
    expect(res.status).toBe(301);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/alice/notes");
    expect(location.searchParams.get("t")).toBe("abc.def");
    expect(location.searchParams.get("via")).toBe("card");
  });

  it("301s flat asset paths to their nested form", () => {
    const res = mini("/alice-notes/app.js");
    expect(res.status).toBe(301);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe(
      "/alice/notes/app.js"
    );
  });

  it("chains legacy /mini/<u>-<a> → flat → nested, one hop at a time", () => {
    const first = mini("/mini/alice-notes?t=tok");
    expect(first.status).toBe(301);
    const hop = new URL(first.headers.get("location") ?? "");
    expect(hop.pathname).toBe("/alice-notes");
    const second = mini(`${hop.pathname}${hop.search}`);
    expect(second.status).toBe(301);
    const final = new URL(second.headers.get("location") ?? "");
    expect(final.pathname).toBe("/alice/notes");
    expect(final.searchParams.get("t")).toBe("tok");
  });

  it("serves the publisher page and the detail alias", () => {
    expect(mini("/alice").headers.get("x-middleware-rewrite") ?? "").toContain(
      "/mini/u/alice"
    );
    expect(
      mini("/alice/notes/store").headers.get("x-middleware-rewrite") ?? ""
    ).toContain("/mini/store/alice-notes");
    expect(
      mini("/alice/notes/store").headers.get("x-middleware-request-x-mini-nested")
    ).toBeNull();
  });

  it("reserved first segments stay store/first-party routes", () => {
    expect(mini("/store/kanban").headers.get("x-middleware-rewrite") ?? "").toContain(
      "/mini/store/kanban"
    );
    expect(mini("/kanban").headers.get("x-middleware-rewrite") ?? "").toContain(
      "/mini/kanban"
    );
    expect(mini("/kanban").headers.get("x-middleware-request-x-mini-nested")).toBeNull();
    expect(mini("/create").headers.get("x-middleware-rewrite") ?? "").toContain(
      "/mini/create"
    );
  });

  it("strips a spoofed x-mini-nested marker", () => {
    const res = mini("/kanban", { "x-mini-nested": "1" });
    expect(res.headers.get("x-middleware-request-x-mini-nested")).toBeNull();
  });

  it("passes /api/create/* through marked as mini-host", () => {
    const res = mini("/api/create/projects");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-mini-host")).toBe("1");
  });
});
