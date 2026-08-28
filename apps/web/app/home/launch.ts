"use client";

/**
 * D12 shared mini-app launcher: every "open app" affordance in /home goes
 * through here. Opens a placeholder window synchronously so popup blockers
 * allow it, mints a signed link via POST /api/mini/link, then points the
 * window at it. Resolves false (and closes the placeholder) when the mint
 * fails so callers can surface their own error copy.
 *
 * Every failure path emits a structured console line carrying the target
 * slug and elapsed ms, so a "Couldn't open" toast can be traced to the mint
 * round-trip, an empty URL, a network throw, or a blocked popup.
 */
export type LaunchTarget = { app: string } | { target: "store" };

export type LaunchFailure =
  | "mint_not_ok"
  | "empty_url"
  | "fetch_threw"
  | "popup_blocked";

export interface LaunchResult {
  ok: boolean;
  /** Slug (or "store") the launch was aimed at. */
  slug: string;
  /** Total ms from click to resolution. */
  ms: number;
  /** Ms spent in POST /api/mini/link. */
  mintMs: number;
  /** HTTP status of the mint, when a response came back. */
  status?: number;
  reason?: LaunchFailure;
}

function targetSlug(target: LaunchTarget): string {
  return "app" in target ? target.app : "store";
}

function round(ms: number): number {
  return Math.round(ms * 10) / 10;
}

/**
 * Launch with diagnostics. `launchMiniApp` wraps this for callers that only
 * need the boolean.
 */
export async function launchMiniAppDetailed(
  target: LaunchTarget
): Promise<LaunchResult> {
  const slug = targetSlug(target);
  const t0 = performance.now();
  const win = window.open("about:blank", "_blank");
  if (!win) {
    console.warn(
      JSON.stringify({
        msg: "miniapp launch popup blocked",
        slug,
        ms: round(performance.now() - t0),
      })
    );
  }
  try {
    const mintStart = performance.now();
    const res = await fetch("/api/mini/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    });
    const mintMs = round(performance.now() - mintStart);
    const data = res.ok
      ? ((await res.json().catch(() => ({}))) as { url?: string })
      : {};
    if (data.url) {
      const navStart = performance.now();
      if (win) win.location.href = data.url;
      else window.open(data.url, "_blank", "noopener");
      const ms = round(performance.now() - t0);
      console.info(
        JSON.stringify({
          msg: "miniapp launch",
          slug,
          status: res.status,
          mint_ms: mintMs,
          nav_ms: round(performance.now() - navStart),
          ms,
          popup_blocked: !win,
        })
      );
      return { ok: true, slug, ms, mintMs, status: res.status };
    }
    win?.close();
    const ms = round(performance.now() - t0);
    const reason: LaunchFailure = res.ok ? "empty_url" : "mint_not_ok";
    console.error(
      JSON.stringify({
        msg: "miniapp launch failed",
        slug,
        reason,
        status: res.status,
        mint_ms: mintMs,
        ms,
      })
    );
    return { ok: false, slug, ms, mintMs, status: res.status, reason };
  } catch (err) {
    win?.close();
    const ms = round(performance.now() - t0);
    console.error(
      JSON.stringify({
        msg: "miniapp launch failed",
        slug,
        reason: "fetch_threw",
        error: err instanceof Error ? err.message : String(err),
        ms,
      })
    );
    return { ok: false, slug, ms, mintMs: ms, reason: "fetch_threw" };
  }
}

export async function launchMiniApp(target: LaunchTarget): Promise<boolean> {
  return (await launchMiniAppDetailed(target)).ok;
}
