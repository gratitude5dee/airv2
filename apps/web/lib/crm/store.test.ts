/** CRM store (MA6 #9): patch sanitizing, upsert/delete semantics, and the
 * avatar index that feeds calendar attendee chips. Pure functions only —
 * the box I/O paths are exercised via the shared box client elsewhere. */
import { describe, expect, it } from "vitest";
import {
  applyPatch,
  avatarIndex,
  initialsFor,
  sanitizePatch,
  type CrmStore,
} from "./store";

const PROV = { source: "owner" as const, at: "2026-08-19T00:00:00Z" };

function storeWith(people: CrmStore["people"]): CrmStore {
  return { version: 1, people };
}

describe("sanitizePatch", () => {
  it("keeps only known string/array fields and truncates", () => {
    const patch = sanitizePatch({
      name: "x".repeat(300),
      emails: ["a@b.co", 7, "  ", "c@d.co"],
      delete: "yes",
      evil: "field",
    });
    expect(patch.name).toHaveLength(200);
    expect(patch.emails).toEqual(["a@b.co", "c@d.co"]);
    expect(patch.delete).toBeUndefined();
    expect("evil" in patch).toBe(false);
  });
});

describe("applyPatch", () => {
  it("upserts a new person with provenance", () => {
    const { store, person } = applyPatch(
      storeWith([]),
      { name: "Ada", emails: ["ada@example.com"] },
      PROV
    );
    expect(store.people).toHaveLength(1);
    expect(person?.provenance).toEqual([PROV]);
  });

  it("delete removes the whole record — photo refs cannot orphan", () => {
    const base = applyPatch(
      storeWith([]),
      { name: "Ada", photos: ["r2://owner/ada.png"] },
      PROV
    );
    const personId = base.person?.id ?? "";
    const { store } = applyPatch(
      base.store,
      { person_id: personId, delete: true },
      PROV
    );
    expect(store.people).toHaveLength(0);
    expect(JSON.stringify(store)).not.toContain("ada.png");
  });
});

describe("avatarIndex", () => {
  it("maps lowercased emails to initials + stable color", () => {
    const { store } = applyPatch(
      storeWith([]),
      { name: "Ada Lovelace", emails: ["Ada@Example.com"] },
      PROV
    );
    const index = avatarIndex(store);
    const avatar = index.get("ada@example.com");
    expect(avatar?.initials).toBe("AL");
    expect(avatar?.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(initialsFor("ada@example.com")).toBe("A");
  });
});
