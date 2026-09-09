/**
 * Mini-app state lives in the user's box filesystem (C4: no content in
 * shared Postgres). Each app keeps a JSON document per resource under
 * `.hermes/miniapps/<app>/<resource>.json`, so the agent's own tools and the
 * mini-app views read and write the same state.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BoxApiError, readFile, writeFile } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { withStateLease } from "./stateLease";

export interface KanbanCard {
  id: string;
  text: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  cards: KanbanCard[];
}

export interface KanbanBoard {
  title: string;
  columns: KanbanColumn[];
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoList {
  title: string;
  items: TodoItem[];
}

const DEFAULT_BOARD: KanbanBoard = {
  title: "Board",
  columns: [
    { id: "todo", name: "To do", cards: [] },
    { id: "doing", name: "Doing", cards: [] },
    { id: "done", name: "Done", cards: [] },
  ],
};

const DEFAULT_TODOS: TodoList = { title: "To-Do", items: [] };

function docPath(app: string, resourceId: string): string {
  return `.hermes/miniapps/${app}/${resourceId}.json`;
}

async function readDoc<T>(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resourceId: string,
  fallback: T
): Promise<T> {
  const box = await ensureBoxAwake(supabase, userId);
  return readDocFrom(box.boxId, app, resourceId, fallback);
}

async function readDocFrom<T>(boxId: string, app: string, resourceId: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(boxId, docPath(app, resourceId));
    return JSON.parse(raw) as T;
  } catch (error) {
    // Only an absent document permits initialization. A failed read or
    // malformed document must never become an empty board on the next write.
    if (error instanceof BoxApiError && error.status === 404) {
      return structuredClone(fallback);
    }
    throw error;
  }
}

async function writeDoc<T>(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resourceId: string,
  doc: T
): Promise<void> {
  if (app === "kanban" || app === "todo") {
    await withStateLease(supabase, userId, app, resourceId, { attempts: 3 }, async (boxId) => {
      await writeAppStateTo(boxId, app, resourceId, doc);
    });
  } else {
    const box = await ensureBoxAwake(supabase, userId);
    await writeAppStateTo(box.boxId, app, resourceId, doc);
  }
}

async function mutateDoc<T>(
  supabase: SupabaseClient, userId: string, app: string, resourceId: string,
  fallback: T, mutate: (doc: T) => boolean
): Promise<T> {
  return withStateLease(supabase, userId, app, resourceId, { attempts: 3 }, async (boxId, renew) => {
    const doc = await readDocFrom(boxId, app, resourceId, fallback);
    if (mutate(doc)) {
      await renew();
      await writeAppStateTo(boxId, app, resourceId, doc);
    }
    return doc;
  });
}

/**
 * MA3 Apps API state: published apps keep their state in the session user's
 * box at the same path convention the first-party apps use (C4). Capped and
 * shape-checked at the route; stored verbatim here.
 */
export async function readAppState(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resourceId: string
): Promise<unknown> {
  return await readDoc<unknown>(supabase, userId, app, resourceId, {});
}

export async function writeAppState(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resourceId: string,
  state: unknown
): Promise<void> {
  await writeDoc(supabase, userId, app, resourceId, state);
}

/**
 * Same documents against a Box the caller already woke: one bounded Box
 * request each, no wake/resume inside — for callers holding a lease. A
 * missing file (404) or unparseable one reads as `{}`; anything else (failed
 * `cat`, timeout, Box 5xx, network) propagates, because a
 * read-modify-write caller that treated it as empty would overwrite the
 * document with a fresh one.
 */
export async function readAppStateFrom(
  boxId: string,
  app: string,
  resourceId: string
): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(boxId, docPath(app, resourceId));
  } catch (error) {
    if (error instanceof BoxApiError && error.status === 404) return {};
    throw error;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

export async function writeAppStateTo(
  boxId: string,
  app: string,
  resourceId: string,
  state: unknown
): Promise<void> {
  await writeFile(boxId, docPath(app, resourceId), JSON.stringify(state, null, 2));
}

export async function getKanban(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string
): Promise<KanbanBoard> {
  return await readDoc(supabase, userId, "kanban", resourceId, DEFAULT_BOARD);
}

export async function moveKanbanCard(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  cardId: string,
  toColumnId: string
): Promise<KanbanBoard> {
  return mutateDoc(supabase, userId, "kanban", resourceId, DEFAULT_BOARD, (board) => {
    const target = board.columns.find((c) => c.id === toColumnId);
    if (!target) return false;
    let moved: KanbanCard | undefined;
    for (const column of board.columns) {
      const index = column.cards.findIndex((c) => c.id === cardId);
      if (index >= 0) {
        [moved] = column.cards.splice(index, 1);
        break;
      }
    }
    if (moved && target) {
      target.cards.push(moved);
      return true;
    }
    return false;
  });
}

export async function addKanbanCard(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  columnId: string,
  text: string
): Promise<KanbanBoard> {
  return mutateDoc(supabase, userId, "kanban", resourceId, DEFAULT_BOARD, (board) => {
    const column =
      board.columns.find((c) => c.id === columnId) ?? board.columns[0];
    if (column && text.trim()) {
      column.cards.push({
        id: `c${randomUUID()}`,
        text: text.trim().slice(0, 200),
      });
      return true;
    }
    return false;
  });
}

export async function getTodos(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string
): Promise<TodoList> {
  return await readDoc(supabase, userId, "todo", resourceId, DEFAULT_TODOS);
}

export async function updateTodo(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  action: { kind: "add"; text: string } | { kind: "toggle"; id: string }
): Promise<TodoList> {
  return mutateDoc(supabase, userId, "todo", resourceId, DEFAULT_TODOS, (list) => {
    if (action.kind === "add" && action.text.trim()) {
      list.items.push({
        id: `t${randomUUID()}`,
        text: action.text.trim().slice(0, 200),
        done: false,
      });
      return true;
    } else if (action.kind === "toggle") {
      const item = list.items.find((i) => i.id === action.id);
      if (item) {
        item.done = !item.done;
        return true;
      }
    }
    return false;
  });
}
