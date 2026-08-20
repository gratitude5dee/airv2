"use client";

/**
 * D12 shared mini-app launcher: every "open app" affordance in /home goes
 * through here. Opens a placeholder window synchronously so popup blockers
 * allow it, mints a signed link via POST /api/mini/link, then points the
 * window at it. Resolves false (and closes the placeholder) when the mint
 * fails so callers can surface their own error copy.
 */
export type LaunchTarget = { app: string } | { target: "store" };

export async function launchMiniApp(target: LaunchTarget): Promise<boolean> {
  const win = window.open("about:blank", "_blank");
  try {
    const res = await fetch("/api/mini/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    });
    const data = res.ok
      ? ((await res.json().catch(() => ({}))) as { url?: string })
      : {};
    if (data.url) {
      if (win) win.location.href = data.url;
      else window.open(data.url, "_blank", "noopener");
      return true;
    }
    win?.close();
    return false;
  } catch {
    win?.close();
    return false;
  }
}
