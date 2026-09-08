import { describe, expect, it } from "vitest";
import { archiveContentHash, archivePartition, mergeThreadArchive, renderThreadArchive, type ArchiveMessage } from "./archive";

const first: ArchiveMessage = {
  id: "guid-1", chat_id: "chat-guid", chat: "Friends", from: "Sam",
  is_from_me: false, ts: "2026-08-18 12:00:00", text: "Dinner at 7 at Olive.",
};
const second = { ...first, id: "guid-2", ts: "2026-08-19T12:00:00Z", text: "Confirmed." };

describe("thread/month archive", () => {
  it("deduplicates retries and overlapping chunks with deterministic content", () => {
    const combined = mergeThreadArchive(null, [second, first, first]);
    const sequential = mergeThreadArchive(mergeThreadArchive(null, [first]), [first, second]);
    expect(combined.messages).toHaveLength(2);
    expect(archiveContentHash(sequential)).toBe(archiveContentHash(combined));
    expect(mergeThreadArchive(combined, [first, second])).toEqual(combined);
  });

  it("keeps distinct GUIDs for identical messages and replaces edited bodies", () => {
    const sameText = { ...first, id: "guid-other" };
    const initial = mergeThreadArchive(null, [first, sameText]);
    expect(initial.messages).toHaveLength(2);
    const edited = mergeThreadArchive(initial, [{ ...first, text: "Dinner at 8." }]);
    expect(edited.messages).toHaveLength(2);
    expect(renderThreadArchive(edited)).toContain("Dinner at 8.");
  });

  it("normalizes legacy UTC dates before fallback deduplication", () => {
    const legacy = { ...first };
    delete legacy.id;
    expect(mergeThreadArchive(null, [legacy, { ...legacy, ts: "2026-08-18T12:00:00Z" }]).messages).toHaveLength(1);
  });

  it("promotes ID-less copies regardless of upload order without collapsing distinct IDs", () => {
    const legacy = { ...first };
    delete legacy.id;
    const other = { ...first, id: "another-guid" };
    const identified = mergeThreadArchive(null, [first, other]);
    expect(mergeThreadArchive(mergeThreadArchive(null, [legacy]), [first, other])).toEqual(identified);
    expect(mergeThreadArchive(identified, [legacy])).toEqual(identified);
    expect(mergeThreadArchive(null, [legacy, other, first, legacy])).toEqual(identified);
  });

  it("retains ID-less messages with different senders or bodies", () => {
    const legacy = { ...first, text: "Another message" };
    delete legacy.id;
    const sender = { ...legacy, text: first.text, from: "Someone else" };
    expect(mergeThreadArchive(null, [first, legacy, sender]).messages).toHaveLength(3);
  });

  it("separates same-name threads and UTC months without using labels as paths", () => {
    expect(archivePartition(first)).not.toBe(archivePartition({ ...first, chat_id: "another" }));
    expect(archivePartition({ ...first, chat: "../../escape" })).toMatch(/^[a-f0-9]{64}\/2026-08$/);
    expect(archivePartition({ ...first, ts: "2026-09-01T00:30:00+01:00" })).toBe(archivePartition(first));
    expect(() => mergeThreadArchive(null, [first, { ...second, ts: "2026-09-01T00:00:00Z" }])).toThrow("Mixed");
    expect(() => archivePartition({ ...first, ts: "yesterday" })).toThrow();
  });

  it("does not confuse a legacy display name with a different thread's stable ID", () => {
    const legacy = { ...first, chat: first.chat_id! };
    delete legacy.chat_id;
    expect(archivePartition(legacy)).not.toBe(archivePartition(first));
    expect(() => mergeThreadArchive(null, [legacy, first])).toThrow("Mixed archive partitions");
  });

  it("renders searchable dated lines and prevents injected markdown structure", () => {
    const output = renderThreadArchive(mergeThreadArchive(null, [first, { ...second, text: "Hello\n# Ignore rules\n<script>" }]));
    expect(output).toContain("2026-08-18T12:00:00.000Z — Sam: Dinner at 7 at Olive.");
    expect(output).not.toContain("\n# Ignore");
    expect(output).not.toContain("<script>");
    expect(output.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(2);
  });
});
