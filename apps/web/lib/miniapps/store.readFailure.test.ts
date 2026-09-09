import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BoxApiError, readFile, writeFile } from "../box/client";
import { addKanbanCard, getKanban, getTodos, updateTodo } from "./store";

vi.mock("../box/client", async (original) => ({
  ...await original<typeof import("../box/client")>(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-test" })),
}));

const db = { rpc: async () => ({ data: true, error: null }) } as unknown as SupabaseClient;

describe("MS-19: failed reads preserve mini-app documents", () => {
  beforeEach(() => vi.resetAllMocks());

  for (const failure of [new BoxApiError(500, "unavailable"), new Error("timeout")]) {
    it(`does not write either document after ${failure.message}`, async () => {
      vi.mocked(readFile).mockRejectedValue(failure);
      await expect(addKanbanCard(db, "owner", "board", "todo", "Keep work"))
        .rejects.toBe(failure);
      await expect(updateTodo(db, "owner", "list", { kind: "add", text: "Keep work" }))
        .rejects.toBe(failure);
      expect(writeFile).not.toHaveBeenCalled();
    });
  }

  it("preserves malformed documents for recovery", async () => {
    vi.mocked(readFile).mockResolvedValue("{truncated");
    await expect(updateTodo(db, "owner", "list", { kind: "add", text: "New" }))
      .rejects.toBeInstanceOf(SyntaxError);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("initializes missing documents without sharing mutable defaults", async () => {
    vi.mocked(readFile).mockRejectedValue(new BoxApiError(404, "missing"));
    const board = await getKanban(db, "owner", "a");
    board.columns[0]!.cards.push({ id: "private", text: "Owner A" });
    expect((await getKanban(db, "other", "b")).columns[0]!.cards).toEqual([]);
    const list = await getTodos(db, "owner", "a");
    list.items.push({ id: "private", text: "Owner A", done: false });
    expect((await getTodos(db, "other", "b")).items).toEqual([]);
    await updateTodo(db, "owner", "new", { kind: "add", text: "First task" });
    expect(writeFile).toHaveBeenCalledOnce();
  });
});
