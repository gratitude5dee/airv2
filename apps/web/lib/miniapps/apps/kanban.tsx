/** Kanban mini-app renderer (extracted from the M7.5 monolith, MA1). */
import { NextResponse } from "next/server";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { externalOrigin } from "../gates";
import { esc, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
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
  isOwner: boolean,
  lite: boolean
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
          return `<div class="card">${esc(card.text)}<div class="row" style="margin-top:0.4rem">${moves}</div></div>`;
        })
        .join("");
      return `<div class="col"><h2>${esc(col.name)}</h2>${cards}</div>`;
    })
    .join("");
  const firstCol = board.columns[0]?.id ?? "todo";
  const body = `<div class="cols">${cols}</div>
<section class="panel"><form method="post" class="addrow"><input type="hidden" name="action" value="add"><input type="hidden" name="column" value="${esc(firstCol)}"><input type="text" name="text" placeholder="Add a card…" maxlength="200"><button>Add</button></form>
${isOwner ? promptBar("Ask your agent — e.g. move everything blocked to done…") : ""}</section>
<!-- resource: ${esc(resourceId)} -->`;
  return renderShell({
    title: board.title,
    kicker: "Board",
    body,
    lite,
    headline: false,
  });
}

const unavailable = (lite: boolean) =>
  shellHtml(
    renderShell({
      title: "Kanban",
      kicker: "Board",
      body: '<section class="panel"><p>Your agent\'s computer can\'t start right now — try again in a few minutes.</p></section>',
      lite,
    })
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
      if (error instanceof StartLimitError) {
        return unavailable(ctx.session.via === "card");
      }
      throw error;
    }
    return shellHtml(
      renderKanban(
        board,
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

  // Multiplayer boards let guests move and add cards on the shared resource.
  guestActions: ["move", "add"],
};
