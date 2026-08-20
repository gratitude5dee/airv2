/** Kanban mini-app renderer (extracted from the M7.5 monolith, MA1). */
import { NextResponse } from "next/server";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { externalOrigin } from "../gates";
import { esc, html, page, withBaseHeaders } from "../html";
import {
  addKanbanCard,
  getKanban,
  moveKanbanCard,
  type KanbanBoard,
} from "../store";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

function renderKanban(
  board: KanbanBoard,
  resourceId: string,
  isOwner: boolean
): string {
  const cols = board.columns
    .map((col) => {
      const cards = col.cards
        .map((card) => {
          const moves = board.columns
            .filter((c) => c.id !== col.id)
            .map(
              (c) =>
                `<form method="post"><input type="hidden" name="action" value="move"><input type="hidden" name="card" value="${esc(card.id)}"><input type="hidden" name="to" value="${esc(c.id)}"><button class="ghost">→ ${esc(c.name)}</button></form>`
            )
            .join("");
          return `<div class="card">${esc(card.text)}<div style="display:flex;gap:4px;margin-top:6px">${moves}</div></div>`;
        })
        .join("");
      return `<div class="col"><h2>${esc(col.name)}</h2>${cards}</div>`;
    })
    .join("");
  const firstCol = board.columns[0]?.id ?? "todo";
  return page(
    board.title,
    `<h1>${esc(board.title)}</h1><div class="cols">${cols}</div>
<form method="post" class="addrow"><input type="hidden" name="action" value="add"><input type="hidden" name="column" value="${esc(firstCol)}"><input type="text" name="text" placeholder="Add a card…" maxlength="200"><button>Add</button></form>
${isOwner ? promptBar("Ask your agent — e.g. move everything blocked to done…") : ""}
<!-- resource: ${esc(resourceId)} -->`
  );
}

const unavailable = () =>
  html(
    page(
      "Kanban",
      "<h1>Kanban</h1><p>Your agent's computer can't start right now — try again in a few minutes.</p>"
    )
  );

export const kanban: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    let board: KanbanBoard;
    try {
      board = await getKanban(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
    } catch (error) {
      if (error instanceof StartLimitError) return unavailable();
      throw error;
    }
    return html(
      renderKanban(
        board,
        ctx.session.resourceId,
        ctx.session.role === "owner"
      )
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const action = String(form.get("action") ?? "");
    try {
      if (action === "prompt") {
        await runPrompt(ctx, String(form.get("text") ?? ""));
      } else if (action === "move") {
        await moveKanbanCard(
          ctx.supabase,
          ctx.session.userId,
          ctx.session.resourceId,
          String(form.get("card") ?? ""),
          String(form.get("to") ?? "")
        );
      } else if (action === "add") {
        await addKanbanCard(
          ctx.supabase,
          ctx.session.userId,
          ctx.session.resourceId,
          String(form.get("column") ?? ""),
          String(form.get("text") ?? "")
        );
      }
    } catch (error) {
      if (error instanceof StartLimitError) return unavailable();
      throw error;
    }
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(ctx.basePath, externalOrigin(ctx.request)),
        303
      )
    );
  },

  // Multiplayer boards let guests move and add cards on the shared resource.
  guestActions: ["move", "add"],
};
