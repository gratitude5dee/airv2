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
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
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

function renderList(basePath: string, store: CrmStore, lite: boolean): string {
  const rows = store.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const contact = p.emails[0] ?? p.phones[0] ?? "";
      const extra = p.emails.length + p.phones.length - (contact ? 1 : 0);
      return `<tr><td><a href="${esc(basePath)}?person=${encodeURIComponent(p.id)}" style="display:inline-flex;align-items:center;gap:0.5rem;min-height:2.4rem;text-decoration:none;color:inherit">${avatar(p)}<strong>${esc(p.name)}</strong></a></td><td class="when">${p.tags.map((t) => esc(t)).join(" \u00b7 ")}</td><td class="when">${esc(contact)}${extra > 0 ? ` +${extra}` : ""}</td></tr>`;
    })
    .join("");
  const table = rows
    ? `<div class="tablewrap"><table><thead><tr><th scope="col">Name</th><th scope="col">Tags</th><th scope="col">Contact</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : "";
  const empty =
    store.people.length === 0
      ? `<p class="muted">No people yet \u2014 add one below, or let your agent fill this in from conversations.</p>`
      : "";
  const addForm = `<form method="post" class="addrow"><input type="hidden" name="action" value="upsert"><input type="text" name="name" placeholder="Add a person\u2026" required><button>Add</button></form>`;
  const body = `<section class="panel">${table}${empty}${addForm}
${promptBar("Ask your agent — e.g. who haven't I talked to lately…")}</section>`;
  return renderShell({ title: "People", kicker: "People", body, lite });
}

function renderDetail(
  basePath: string,
  person: CrmPerson,
  unlinkedSenders: SenderRow[],
  lite: boolean
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
        `<div class="item"><span class="grow">${esc(sender.address)}</span><span class="when">${esc(sender.platform)}</span><form method="post" class="inline"><input type="hidden" name="action" value="link_sender"><input type="hidden" name="person" value="${esc(person.id)}"><input type="hidden" name="sender" value="${esc(sender.id)}"><button class="ghost">Link</button></form></div>`
    )
    .join("");
  const merge = mergeRows
    ? `<h2>Merge with a sender</h2>${mergeRows}`
    : "";
  const editForm = `<form method="post" class="stack"><input type="hidden" name="action" value="upsert"><input type="hidden" name="person" value="${esc(person.id)}"><input type="text" name="name" value="${esc(person.name)}"><input type="text" name="tags" value="${esc(person.tags.join(", "))}" placeholder="tags, comma separated"><input type="text" name="notes" value="${esc(person.notes)}" placeholder="notes"><div class="row"><button>Save</button></div></form>`;
  const deleteForm = `<form method="post" class="row actions"><input type="hidden" name="action" value="delete"><input type="hidden" name="person" value="${esc(person.id)}"><button class="ghost">Delete person</button></form>`;
  const body = `<section class="panel"><p><a href="${esc(basePath)}">\u2190 People</a></p><div class="card"><div class="row">${avatar(person)}<strong>${esc(person.name)}</strong></div>${chips || `<span class="when">no contact info yet</span>`}${person.notes ? `<p>${esc(person.notes)}</p>` : ""}${provenance ? `<div>${provenance}</div>` : ""}</div>${editForm}${merge}${deleteForm}</section>`;
  return renderShell({ title: person.name, kicker: "People", body, lite });
}

const unavailable = (lite: boolean) =>
  shellHtml(
    renderShell({
      title: "People",
      kicker: "People",
      body: `<section class="panel"><p>Your agent's computer can't start right now \u2014 try again in a few minutes.</p></section>`,
      lite,
    })
  );

export const crm: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const lite = ctx.session.via === "card";
    let store: CrmStore;
    try {
      const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
      store = await readPeople(box.boxId);
    } catch {
      return unavailable(lite);
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
        return shellHtml(renderDetail(ctx.basePath, person, unlinked, lite));
      }
    }
    return shellHtml(renderList(ctx.basePath, store, lite));
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
        return unavailable(ctx.session.via === "card");
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
