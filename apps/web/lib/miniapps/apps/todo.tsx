/** To-Do mini-app renderer (extracted from the M7.5 monolith, MA1). */
import { NextResponse } from "next/server";
import { esc, html, page, withBaseHeaders } from "../html";
import { getTodos, updateTodo, type TodoList } from "../store";
import type { MiniAppContext, MiniAppModule } from "./types";

function renderTodo(list: TodoList, resourceId: string): string {
  const items = list.items
    .map(
      (item) =>
        `<div class="item"><form method="post" style="margin:0"><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="${esc(item.id)}"><button class="ghost">${item.done ? "☑" : "☐"}</button></form><span class="${item.done ? "done" : ""}">${esc(item.text)}</span></div>`
    )
    .join("");
  return page(
    list.title,
    `<h1>${esc(list.title)}</h1>${items}
<form method="post" class="addrow"><input type="hidden" name="action" value="add"><input type="text" name="text" placeholder="Add a task…" maxlength="200"><button>Add</button></form>
<!-- resource: ${esc(resourceId)} -->`
  );
}

export const todo: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    const list = await getTodos(
      ctx.supabase,
      ctx.session.userId,
      ctx.session.resourceId
    );
    return html(renderTodo(list, ctx.session.resourceId));
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const action = String(form.get("action") ?? "");
    if (action === "add") {
      await updateTodo(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId,
        { kind: "add", text: String(form.get("text") ?? "") }
      );
    } else if (action === "toggle") {
      await updateTodo(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId,
        { kind: "toggle", id: String(form.get("id") ?? "") }
      );
    }
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(ctx.basePath, ctx.request.nextUrl.origin),
        303
      )
    );
  },

  guestActions: ["add", "toggle"],
};
