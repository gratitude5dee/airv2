/** To-Do mini-app renderer (extracted from the M7.5 monolith, MA1). */
import { NextResponse } from "next/server";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { externalOrigin } from "../gates";
import { esc, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { getTodos, updateTodo, type TodoList } from "../store";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

function renderTodo(
  list: TodoList,
  resourceId: string,
  isOwner: boolean,
  lite: boolean
): string {
  const items = list.items
    .map(
      (item) =>
        `<div class="item"><form method="post" class="inline"><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="${esc(item.id)}"><button class="ghost">${item.done ? "☑" : "☐"}</button></form><span class="grow${item.done ? " done" : ""}">${esc(item.text)}</span></div>`
    )
    .join("");
  const body = `<section class="panel">${items || '<p class="muted">Nothing here yet — add your first task below.</p>'}
<form method="post" class="addrow"><input type="hidden" name="action" value="add"><input type="text" name="text" placeholder="Add a task…" maxlength="200"><button>Add</button></form>
${isOwner ? promptBar("Ask your agent — e.g. plan my day from this list…") : ""}</section>
<!-- resource: ${esc(resourceId)} -->`;
  return renderShell({ title: list.title, kicker: "Tasks", body, lite });
}

const unavailable = (lite: boolean) =>
  shellHtml(
    renderShell({
      title: "To-Do",
      kicker: "Tasks",
      body: '<section class="panel"><p>Your agent\'s computer can\'t start right now — try again in a few minutes.</p></section>',
      lite,
    })
  );

export const todo: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    let list: TodoList;
    try {
      list = await getTodos(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
    } catch (error) {
      if (error instanceof StartLimitError) {
        return unavailable(ctx.session.via === "card");
      }
      throw error;
    }
    return shellHtml(
      renderTodo(
        list,
        ctx.session.resourceId,
        ctx.session.role === "owner",
        ctx.session.via === "card"
      )
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const action = String(form.get("action") ?? "");
    try {
      if (action === "prompt") {
        await runPrompt(ctx, String(form.get("text") ?? ""));
      } else if (action === "add") {
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
    } catch (error) {
      if (error instanceof StartLimitError) {
        return unavailable(ctx.session.via === "card");
      }
      throw error;
    }
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(ctx.basePath, externalOrigin(ctx.request)),
        303
      )
    );
  },

  guestActions: ["add", "toggle"],
};
