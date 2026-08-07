/**
 * Mini-app state lives in the user's box filesystem (C4: no content in
 * shared Postgres). Each app keeps a JSON document per resource under
 * `.hermes/miniapps/<app>/<resource>.json`, so the agent's own tools and the
 * mini-app views read and write the same state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";

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
  try {
    const raw = await readFile(box.boxId, docPath(app, resourceId));
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeDoc<T>(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resourceId: string,
  doc: T
): Promise<void> {
  const box = await ensureBoxAwake(supabase, userId);
  await writeFile(
    box.boxId,
    docPath(app, resourceId),
    JSON.stringify(doc, null, 2)
  );
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
  const board = await getKanban(supabase, userId, resourceId);
  let moved: KanbanCard | undefined;
  for (const column of board.columns) {
    const index = column.cards.findIndex((c) => c.id === cardId);
    if (index >= 0) {
      [moved] = column.cards.splice(index, 1);
      break;
    }
  }
  const target = board.columns.find((c) => c.id === toColumnId);
  if (moved && target) {
    target.cards.push(moved);
    await writeDoc(supabase, userId, "kanban", resourceId, board);
  }
  return board;
}

export async function addKanbanCard(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  columnId: string,
  text: string
): Promise<KanbanBoard> {
  const board = await getKanban(supabase, userId, resourceId);
  const column =
    board.columns.find((c) => c.id === columnId) ?? board.columns[0];
  if (column && text.trim()) {
    column.cards.push({
      id: `c${Date.now().toString(36)}`,
      text: text.trim().slice(0, 200),
    });
    await writeDoc(supabase, userId, "kanban", resourceId, board);
  }
  return board;
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
  const list = await getTodos(supabase, userId, resourceId);
  if (action.kind === "add" && action.text.trim()) {
    list.items.push({
      id: `t${Date.now().toString(36)}`,
      text: action.text.trim().slice(0, 200),
      done: false,
    });
  } else if (action.kind === "toggle") {
    const item = list.items.find((i) => i.id === action.id);
    if (item) item.done = !item.done;
  }
  await writeDoc(supabase, userId, "todo", resourceId, list);
  return list;
}
