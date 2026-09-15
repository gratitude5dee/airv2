/**
 * Watch (Phase 2): the owner watches a Kernel browser session work — live
 * view read-only by default, interactive only while a human-control lease
 * is held (C31), and replays after the session ends. Every URL Kernel hands
 * us is a bearer credential: the DB holds sealed envelopes and each render
 * mints a fresh unsealed URL that lives in the iframe and nowhere else
 * (C27). Owner-only — guests and card viewers get the empty-state page.
 */
import { NextResponse } from "next/server";
import {
  beginKernelHumanControl,
  endKernelSession,
  getKernelSession,
  kernelHumanControlActive,
  kernelReplayViewUrl,
  kernelSessionSecret,
  listKernelSessions,
  returnKernelHumanControl,
  startKernelReplay,
  stopKernelReplay,
  type KernelSession,
} from "@/lib/kernel/browsers";
import { kernelAvailable } from "@/lib/kernel/client";
import { stageKernelUrlAction } from "@/lib/kernel/actions";
import { externalOrigin } from "../gates";
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";

/** Kernel live-view/replay hosts — CSP frame-src is widened to these only. */
const KERNEL_FRAME_SOURCES =
  "'self' https://*.onkernel.com https://*.onkernel.com:8443 " +
  "https://*.kernel.run https://*.kernel.sh https://*.kernel.sh:8443";

function widenFrameSrc(response: NextResponse): NextResponse {
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  response.headers.set(
    "Content-Security-Policy",
    `${csp}; frame-src ${KERNEL_FRAME_SOURCES}`
  );
  return response;
}

function statusOf(session: KernelSession): string {
  if (kernelHumanControlActive(session)) return "you have control";
  return session.status;
}

function sessionCard(
  session: KernelSession,
  liveViewUrl: string | null,
  replayUrl: string | null
): string {
  const live = kernelHumanControlActive(session);
  const active = session.status === "active";
  const iframe = (url: string, readOnly: boolean) =>
    `<iframe src="${esc(url)}" style="width:100%;height:340px;border:0;border-radius:10px;background:#000" allow="autoplay; clipboard-read; clipboard-write" referrerpolicy="no-referrer"${readOnly ? " sandbox=\"allow-scripts allow-same-origin allow-forms\"" : ""}></iframe>`;
  const control = active
    ? live
      ? `<form method="post"><input type="hidden" name="action" value="return_control"><input type="hidden" name="session" value="${session.id}"><button>Return control to agent</button></form>`
      : `<form method="post"><input type="hidden" name="action" value="take_control"><input type="hidden" name="session" value="${session.id}"><button>Take control</button></form>`
    : "";
  const replayControls = active
    ? session.recording_replay_id
      ? `<form method="post"><input type="hidden" name="action" value="stop_replay"><input type="hidden" name="session" value="${session.id}"><button class="ghost">Stop recording</button></form>`
      : `<form method="post"><input type="hidden" name="action" value="start_replay"><input type="hidden" name="session" value="${session.id}"><button class="ghost">Record</button></form>`
    : "";
  const end = active
    ? `<form method="post"><input type="hidden" name="action" value="end"><input type="hidden" name="session" value="${session.id}"><button class="ghost">End session</button></form>`
    : "";
  const viewer =
    liveViewUrl !== null
      ? iframe(
          liveViewUrl,
          !live
        ) +
        `<p class="muted">${live ? "You're in control — agent input is paused." : "Read-only view — take control to interact."}</p>`
      : replayUrl !== null
        ? iframe(replayUrl, true) + `<p class="muted">Replay.</p>`
        : active
          ? `<p class="muted">Live view is not available for this session yet.</p>`
          : `<p class="muted">Session ended — no replay recorded.</p>`;
  const replayOpen =
    replayUrl !== null && active
      ? `<p><a href="${esc(replayUrl)}" target="_blank" rel="noopener">Open replay</a></p>`
      : "";
  return `<div class="card"><strong>${esc(session.purpose)} session</strong> <span class="when">${esc(statusOf(session))}</span><div class="muted" style="margin:4px 0 8px">${esc(session.task_id ?? "")}</div>${viewer}${replayOpen}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${control}${replayControls}${end}</div></div>`;
}

async function renderWatch(ctx: MiniAppContext): Promise<NextResponse> {
  if (ctx.session.role !== "owner") {
    return forbidden("this view is owner-only");
  }
  if (!kernelAvailable()) {
    return shellHtml(
      renderShell({
        title: "Watch",
        kicker: "Agent browser",
        body: `<section class="panel"><p>Cloud browsing isn't enabled yet. Ask Air to run an errand in a shared browser once it is.</p></section>`,
        lite: ctx.session.via === "card",
      })
    );
  }
  const sessions = await listKernelSessions(
    ctx.supabase,
    ctx.session.userId,
    6
  );
  const cards: string[] = [];
  for (const session of sessions) {
    let liveView: string | null = null;
    let replay: string | null = null;
    if (session.status === "active") {
      const bearer = await kernelSessionSecret(
        ctx.supabase,
        ctx.session.userId,
        session.id,
        "live_view"
      );
      if (bearer) {
        const providerUrl = new URL(bearer);
        providerUrl.searchParams.set(
          "readOnly",
          kernelHumanControlActive(session) ? "false" : "true"
        );
        liveView = (
          await stageKernelUrlAction(
            ctx.supabase,
            ctx.session.userId,
            "live_view",
            providerUrl.toString(),
            session.id
          )
        ).url;
      }
    } else if (session.replay_ids.length > 0) {
      const bearer = await kernelReplayViewUrl(
        ctx.supabase,
        ctx.session.userId,
        session.id,
        session.replay_ids[session.replay_ids.length - 1] as string
      );
      if (bearer) {
        replay = (
          await stageKernelUrlAction(
            ctx.supabase,
            ctx.session.userId,
            "replay_view",
            bearer,
            session.id
          )
        ).url;
      }
    }
    cards.push(sessionCard(session, liveView, replay));
  }
  const body =
    cards.length > 0
      ? cards.join("")
      : `<p>No browser sessions yet. Ask Air to do an errand in a shared browser — when it's enabled, you can watch here.</p>`;
  const response = shellHtml(
    renderShell({
      title: "Watch",
      kicker: "Agent browser",
      body: `<section class="panel">${body}</section>`,
      lite: ctx.session.via === "card",
    })
  );
  return widenFrameSrc(response);
}

export const watch: MiniAppModule = {
  render: renderWatch,
  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const action = String(form.get("action") ?? "");
    const sessionId = String(form.get("session") ?? "");
    const session = await getKernelSession(
      ctx.supabase,
      ctx.session.userId,
      sessionId
    );
    if (!session) {
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(ctx.basePath, externalOrigin(ctx.request)),
          303
        )
      );
    }
    if (action === "take_control") {
      await beginKernelHumanControl(ctx.supabase, ctx.session.userId, session.id);
    } else if (action === "return_control") {
      await returnKernelHumanControl(
        ctx.supabase,
        ctx.session.userId,
        session.id
      );
    } else if (action === "start_replay") {
      await startKernelReplay(ctx.supabase, ctx.session.userId, session.id);
    } else if (action === "stop_replay") {
      await stopKernelReplay(ctx.supabase, ctx.session.userId, session.id);
    } else if (action === "end") {
      await endKernelSession(ctx.supabase, ctx.session.userId, session.id);
    } else {
      return forbidden("unknown action");
    }
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(ctx.basePath, externalOrigin(ctx.request)),
        303
      )
    );
  },
};
