/**
 * Personal CRM mini-app (MA6 #9): list / detail / merge-with-sender over the
 * box-side people store (.hermes/miniapps/crm/people.json, C4). Owner-only:
 * the store is the owner's contact graph, so guests get nothing — there are
 * no guestActions and render refuses guest sessions. All owner edits carry
 * owner provenance; agent edits arrive via the crm_update backing tool.
 */
import { NextResponse } from "next/server";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import {
  applyPatch,
  ditherColor,
  initialsFor,
  readPeople,
  writePeople,
  type CrmPerson,
  type CrmStore,
} from "@/lib/crm/store";
import { externalOrigin } from "../gates";
import { esc, forbidden, html, page, withBaseHeaders } from "../html";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

interface SenderRow {
  id: string;
  platform: string;
  address: string;
  trust_tier: number;
}

function avatar(person: CrmPerson): string {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:${esc(ditherColor(person.id))};color:#fff;font-size:11px;font-weight:600;flex:none">${esc(initialsFor(person.name))}</span>`;
}

function renderList(basePath: string, store: CrmStore): string {
  const rows = store.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (p) =>
        `<a href="${esc(basePath)}?person=${encodeURIComponent(p.id)}" style="text-decoration:none;color:inherit"><div class="item">${avatar(p)}<span style="flex:1">${esc(p.name)}</span><span class="when">${p.tags.map((t) => esc(t)).join(" \u00b7 ")}</span></div></a>`
    )
    .join("");
  const empty =
    store.people.length === 0
      ? `<p class="when">No people yet \u2014 add one below, or let your agent fill this in from conversations.</p>`
      : "";
  const addForm = `<form method="post" class="addrow"><input type="hidden" name="action" value="upsert"><input type="text" name="name" placeholder="Add a person\u2026" required><button>Add</button></form>`;
  return page(
    "People",
    `<h1>People</h1>${rows}${empty}${addForm}
${promptBar("Ask your agent — e.g. who haven't I talked to lately…")}`
  );
}

function renderDetail(
  basePath: string,
  person: CrmPerson,
  unlinkedSenders: SenderRow[]
): string {
  const chips = [
    ...person.emails.map((e) => esc(e)),
    ...person.phones.map((p) => esc(p)),
  ]
    .map((c) => `<span class="when">${c}</span>`)
    .join(" \u00b7 ");
  const provenance = person.provenance
    .slice(-5)
    .reverse()
    .map(
      (entry) =>
        `<div class="when">${esc(entry.source === "agent" ? "agent" : "you")} \u00b7 ${esc(new Date(entry.at).toLocaleDateString())}${entry.note ? ` \u00b7 ${esc(entry.note)}` : ""}</div>`
    )
    .join("");
  const mergeRows = unlinkedSenders
    .slice(0, 10)
    .map(
      (sender) =>
        `<div class="item"><span style="flex:1">${esc(sender.address)}</span><span class="when">${esc(sender.platform)}</span><form method="post" style="margin:0"><input type="hidden" name="action" value="link_sender"><input type="hidden" name="person" value="${esc(person.id)}"><input type="hidden" name="sender" value="${esc(sender.id)}"><button class="ghost">Link</button></form></div>`
    )
    .join("");
  const merge = mergeRows
    ? `<div class="day">Merge with a sender</div>${mergeRows}`
    : "";
  const editForm = `<form method="post" style="margin-top:12px;display:flex;flex-direction:column;gap:6px"><input type="hidden" name="action" value="upsert"><input type="hidden" name="person" value="${esc(person.id)}"><input type="text" name="name" value="${esc(person.name)}"><input type="text" name="tags" value="${esc(person.tags.join(", "))}" placeholder="tags, comma separated"><input type="text" name="notes" value="${esc(person.notes)}" placeholder="notes"><div style="display:flex;gap:6px"><button>Save</button></div></form>`;
  const deleteForm = `<form method="post" style="margin-top:8px"><input type="hidden" name="action" value="delete"><input type="hidden" name="person" value="${esc(person.id)}"><button class="ghost">Delete person</button></form>`;
  return page(
    person.name,
    `<a href="${esc(basePath)}" style="text-decoration:none" class="when">\u2190 People</a><h1 style="margin-top:8px;display:flex;align-items:center;gap:8px">${avatar(person)}${esc(person.name)}</h1><div class="card">${chips || `<span class="when">no contact info yet</span>`}${person.notes ? `<p style="margin:6px 0 0">${esc(person.notes)}</p>` : ""}${provenance ? `<div style="margin-top:8px">${provenance}</div>` : ""}</div>${editForm}${merge}${deleteForm}`
  );
}

const unavailable = () =>
  html(
    page(
      "People",
      "<h1>People</h1><p>Your agent's computer can't start right now \u2014 try again in a few minutes.</p>"
    )
  );

export const crm: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    let store: CrmStore;
    try {
      const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
      store = await readPeople(box.boxId);
    } catch {
      return unavailable();
    } finally {
      await armStopAfter(ctx.supabase, ctx.session.userId).catch(
        () => undefined
      );
    }
    const personId = ctx.request.nextUrl.searchParams.get("person");
    if (personId) {
      const person = store.people.find((p) => p.id === personId);
      if (person) {
        const linked = new Set(store.people.flatMap((p) => p.sender_ids));
        const { data: senderRows } = await ctx.supabase
          .from("senders")
          .select("id, platform, address, trust_tier")
          .eq("user_id", ctx.session.userId)
          .order("first_seen", { ascending: false })
          .limit(50);
        const unlinked = ((senderRows ?? []) as SenderRow[]).filter(
          (s) => !linked.has(s.id)
        );
        return html(renderDetail(ctx.basePath, person, unlinked));
      }
    }
    return html(renderList(ctx.basePath, store));
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const action = String(form.get("action") ?? "");
    const personId = String(form.get("person") ?? "");
    try {
      if (action === "prompt") {
        await runPrompt(ctx, String(form.get("text") ?? ""));
        return withBaseHeaders(
          NextResponse.redirect(
            new URL(ctx.basePath, externalOrigin(ctx.request)),
            303
          )
        );
      }
      const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
      const store = await readPeople(box.boxId);
      const provenance = {
        source: "owner" as const,
        at: new Date().toISOString(),
      };
      if (action === "upsert") {
        const name = String(form.get("name") ?? "").trim().slice(0, 200);
        const patch = {
          ...(personId ? { person_id: personId } : {}),
          ...(name ? { name } : {}),
          ...(form.has("tags")
            ? {
                tags: String(form.get("tags") ?? "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 20),
              }
            : {}),
          ...(form.has("notes")
            ? { notes: String(form.get("notes") ?? "").slice(0, 10_000) }
            : {}),
        };
        if (name || personId) {
          await writePeople(box.boxId, applyPatch(store, patch, provenance).store);
        }
      } else if (action === "delete" && personId) {
        await writePeople(
          box.boxId,
          applyPatch(store, { person_id: personId, delete: true }, provenance)
            .store
        );
      } else if (action === "link_sender" && personId) {
        // Merge-with-sender: verify the sender is the owner's own row, then
        // link its id (and address, when it is an email) onto the person.
        const senderId = String(form.get("sender") ?? "");
        const { data: sender } = await ctx.supabase
          .from("senders")
          .select("id, platform, address")
          .eq("id", senderId)
          .eq("user_id", ctx.session.userId)
          .maybeSingle();
        const person = store.people.find((p) => p.id === personId);
        if (sender && person) {
          const patch = {
            person_id: personId,
            sender_ids: [...new Set([...person.sender_ids, sender.id as string])],
            ...(sender.platform === "email"
              ? {
                  emails: [
                    ...new Set([...person.emails, sender.address as string]),
                  ],
                }
              : {
                  phones: [
                    ...new Set([...person.phones, sender.address as string]),
                  ],
                }),
          };
          await writePeople(box.boxId, applyPatch(store, patch, provenance).store);
        }
      }
    } catch (error) {
      if (error instanceof StartLimitError) {
        return unavailable();
      }
      throw error;
    } finally {
      await armStopAfter(ctx.supabase, ctx.session.userId).catch(
        () => undefined
      );
    }
    const back =
      action === "delete" || !personId
        ? ctx.basePath
        : `${ctx.basePath}?person=${encodeURIComponent(personId)}`;
    return withBaseHeaders(
      NextResponse.redirect(new URL(back, externalOrigin(ctx.request)), 303)
    );
  },
};
