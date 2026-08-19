/**
 * MA9.1 — Settings "Memory" section, self-contained for Session D to mount in
 * lib/miniapps/apps/settings.tsx:
 *
 *   render: `await renderMemorySection(ctx)` → HTML fragment (owner only;
 *           renders a notice for guests).
 *   action: dispatch form posts whose `action` starts with "memory." to
 *           `memoryAction(ctx, form)`; it returns null for actions it does
 *           not own.
 *
 * Memory bytes flow box → response only (C4): nothing here writes them to
 * Postgres or logs.
 */
import { NextResponse } from "next/server";
import { externalOrigin } from "../gates";
import { esc, withBaseHeaders } from "../html";
import {
  clearMemoryFiles,
  readMemoryFiles,
  USER_PROFILE_CHAR_LIMIT,
  writeUserProfile,
  type MemoryTarget,
} from "@/lib/memory/files";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import type { MiniAppContext } from "../apps/types";

export async function renderMemorySection(
  ctx: MiniAppContext
): Promise<string> {
  if (ctx.session.role !== "owner") {
    return `<h2>Memory</h2><p class="muted">Owner only.</p>`;
  }
  let memory: string | null = null;
  let user: string | null = null;
  let unavailable = false;
  try {
    const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
    try {
      ({ memory, user } = await readMemoryFiles(box.boxId));
    } finally {
      await armStopAfter(ctx.supabase, ctx.session.userId).catch(
        () => undefined
      );
    }
  } catch (error) {
    unavailable = true;
    void (error instanceof StartLimitError);
  }
  if (unavailable) {
    return `<h2>Memory</h2><p class="muted">Your computer is waking up — reload in a minute.</p>`;
  }
  return `<h2>Memory</h2>
<p class="muted">What your agent remembers. These files live on your computer, not in our database.</p>
<h3>Agent notes (MEMORY.md)</h3>
<pre>${esc(memory ?? "(empty — your agent hasn't saved any notes yet)")}</pre>
<form method="post" onsubmit="return confirm('Clear the agent\\'s notes? This cannot be undone.')" style="margin:0">
<input type="hidden" name="action" value="memory.clear"><input type="hidden" name="target" value="memory"><input type="hidden" name="confirm" value="true">
<button class="ghost">Clear notes</button></form>
<h3>About you (USER.md)</h3>
<form method="post">
<input type="hidden" name="action" value="memory.save_user">
<textarea name="user" rows="8" maxlength="${USER_PROFILE_CHAR_LIMIT}" style="width:100%">${esc(user ?? "")}</textarea>
<button>Save profile</button></form>
<form method="post" onsubmit="return confirm('Clear your profile? This cannot be undone.')" style="margin:0">
<input type="hidden" name="action" value="memory.clear"><input type="hidden" name="target" value="user"><input type="hidden" name="confirm" value="true">
<button class="ghost">Clear profile</button></form>`;
}

/** Handles `memory.*` actions; returns null when the action is not ours. */
export async function memoryAction(
  ctx: MiniAppContext,
  form: FormData
): Promise<NextResponse | null> {
  const action = String(form.get("action") ?? "");
  if (!action.startsWith("memory.")) return null;
  if (ctx.session.role !== "owner") {
    return withBaseHeaders(
      NextResponse.json({ error: "owner only" }, { status: 403 })
    );
  }
  const redirect = withBaseHeaders(
    NextResponse.redirect(
      new URL(ctx.basePath, externalOrigin(ctx.request)),
      303
    )
  );
  const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
  try {
    if (action === "memory.save_user") {
      const user = String(form.get("user") ?? "");
      if (user.length > USER_PROFILE_CHAR_LIMIT) {
        return withBaseHeaders(
          NextResponse.json({ error: "profile too long" }, { status: 400 })
        );
      }
      await writeUserProfile(box.boxId, user);
      return redirect;
    }
    if (action === "memory.clear") {
      const target = String(form.get("target") ?? "");
      if (
        form.get("confirm") !== "true" ||
        (target !== "memory" && target !== "user" && target !== "both")
      ) {
        return withBaseHeaders(
          NextResponse.json({ error: "confirm required" }, { status: 400 })
        );
      }
      await clearMemoryFiles(box.boxId, target as MemoryTarget);
      return redirect;
    }
    return withBaseHeaders(
      NextResponse.json({ error: "unknown action" }, { status: 400 })
    );
  } finally {
    await armStopAfter(ctx.supabase, ctx.session.userId).catch(
      () => undefined
    );
  }
}
