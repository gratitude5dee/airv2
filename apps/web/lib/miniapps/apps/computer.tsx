/**
 * Computer mini-app (MA6 #4): a one-glance task-state page BEFORE the
 * stream. Opening the app never wakes a stopped box — power state, the
 * current/last run, and (only when the box is already awake) a live desktop
 * embed or screenshot thumbnail. The live view is an iframe pointing at the
 * same-origin ?view=live relay: the redirect to the stream happens inside
 * the browser's network layer, so no *.on.ascii.dev URL ever lands in page
 * HTML or devtools (C16 unchanged). VNC opens top-level, as required.
 */
import { NextResponse } from "next/server";
import { desktopStreamOrigin } from "@/lib/box/desktop";
import { captureScreenshotPng } from "@/lib/box/screenshot";
import { esc, forbidden } from "../html";
import { renderShell, shellHtml } from "../shell";
import { renderPassthrough } from "./passthrough";
import type { MiniAppContext, MiniAppModule } from "./types";

interface BoxRow {
  provider_box_id: string;
  state: string;
}

interface RunRow {
  started_at: string;
  ended_at: string | null;
  trigger: string | null;
  outcome: string | null;
}

function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function renderState(
  basePath: string,
  awake: boolean,
  embed: boolean,
  stateLabel: string,
  run: RunRow | null,
  screenshotDataUri: string | null,
  lite: boolean,
  streamOrigin: string | null
): string {
  const power = `<div class="item"><span class="grow">Power</span><span class="when">${esc(stateLabel)}</span></div>`;
  const runRow = run
    ? `<div class="item"><span class="grow">${run.ended_at ? "Last run" : "Running now"}${run.trigger ? ` \u00b7 ${esc(run.trigger)}` : ""}${run.outcome ? ` \u00b7 ${esc(run.outcome)}` : ""}</span><span class="when">${esc(ago(run.ended_at ?? run.started_at))}</span></div>`
    : `<div class="item"><span class="grow">No runs yet</span></div>`;
  // autoplay: the moonlight viewer's <video> can't start inside an iframe
  // without it (black screen with working audio/none). The keyboard
  // forwarder script bridges parent-page keystrokes into the embedded
  // stream (terminal typing) via the viewer's own postMessage protocol.
  const live = embed
    ? `<div style="margin-top:10px;border-radius:var(--radius-well);overflow:hidden;box-shadow:var(--shadow);background:#000"><iframe id="live-desktop"${streamOrigin ? ` data-stream-origin="${esc(streamOrigin)}"` : ""} src="${esc(basePath)}?view=live" title="Live view of your agent's computer" allow="autoplay; fullscreen; clipboard-read; clipboard-write" allowfullscreen referrerpolicy="no-referrer" style="display:block;width:100%;height:${lite ? "min(62vh,520px)" : "max(62vh,420px)"};border:0"></iframe></div><p class="muted" style="margin-top:8px">Live \u00b7 <a href="${esc(basePath)}?view=live" target="_top">Open full screen</a> \u00b7 choppy? <a href="${esc(basePath)}?view=live&amp;vnc=1" target="_blank" rel="noopener">Switch to VNC</a></p><script src="/creator-os/computer.js" defer></script>`
    : "";
  const shot =
    !embed && screenshotDataUri
      ? `<img src="${screenshotDataUri}" alt="Latest screen" style="width:100%;border-radius:var(--radius-well);box-shadow:var(--shadow);margin-top:10px">`
      : awake || embed
        ? ""
        : `<p class="muted">The computer is asleep \u2014 watching live will wake it.</p>`;
  const watch = embed
    ? ""
    : `<div class="addrow"><a href="${esc(basePath)}?embed=1" style="text-decoration:none"><button>Watch live</button></a></div>`;
  const body = `<section class="panel">${power}${runRow}${live}${shot}${watch}</section>`;
  return renderShell({
    title: "Your agent's computer",
    kicker: "Screen",
    body,
    lite,
  });
}

export const computer: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    if (ctx.request.nextUrl.searchParams.get("view") === "live") {
      // The stream URL rides a Location header only, exactly as before.
      return renderPassthrough(ctx);
    }

    const [{ data: boxRow }, { data: runRows }, { data: stateRows }] =
      await Promise.all([
      ctx.supabase
        .from("boxes")
        .select("provider_box_id, state")
        .eq("user_id", ctx.session.userId)
        .maybeSingle(),
      ctx.supabase
        .from("agent_runs")
        .select("started_at, ended_at, trigger, outcome")
        .eq("user_id", ctx.session.userId)
        .order("started_at", { ascending: false })
        .limit(1),
      ctx.supabase
        .from("box_state_events")
        .select("state, created_at")
        .eq("user_id", ctx.session.userId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const box = boxRow as BoxRow | null;
    const run = ((runRows ?? [])[0] as RunRow | undefined) ?? null;
    const awake = box?.state === "ready" || box?.state === "idle";
    // Embed the live iframe when the box is already awake, or when the user
    // explicitly asked to watch (the iframe's ?view=live request wakes it).
    const embed =
      awake || ctx.request.nextUrl.searchParams.get("embed") === "1";

    // Thumbnail only when the box is ALREADY awake — looking never wakes it.
    let screenshot: string | null = null;
    if (box && awake && !embed) {
      try {
        const png = await captureScreenshotPng(box.provider_box_id, 8);
        screenshot = `data:image/png;base64,${png.toString("base64")}`;
      } catch {
        screenshot = null;
      }
    }

    // The frame origin (host only, never the tokened URL) pins the keyboard
    // forwarder's postMessage target to the exact stream origin.
    const streamOrigin =
      box && awake && embed
        ? await desktopStreamOrigin(box.provider_box_id)
        : null;

    const lastEdge = ((stateRows ?? [])[0] ?? null) as {
      state: string;
      created_at: string;
    } | null;
    const base = !box ? "not provisioned" : awake ? "on" : (box.state ?? "off");
    const stateLabel =
      box && lastEdge ? `${base} \u00b7 since ${ago(lastEdge.created_at)}` : base;
    // The theme CSP's img-src gains data: (when absent) only for the inline
    // screenshot bytes — no remote loads become possible.
    const response = shellHtml(
      renderState(
        ctx.basePath,
        awake,
        embed,
        stateLabel,
        run,
        screenshot,
        ctx.session.via === "card",
        streamOrigin
      )
    );
    let csp = response.headers.get("Content-Security-Policy") ?? "";
    if (!csp.includes("data:")) {
      csp = csp.replace("img-src 'self'", "img-src 'self' data:");
    }
    if (embed) {
      // The iframe src is same-origin, but CSP re-checks the redirect
      // destination, so the desktop host must be allowed under frame-src.
      csp += "; frame-src 'self' https://*.on.ascii.dev";
      // The keyboard-forwarder script is a self-hosted static asset.
      if (!csp.includes("script-src")) csp += "; script-src 'self'";
    }
    response.headers.set("Content-Security-Policy", csp);
    return response;
  },
};
