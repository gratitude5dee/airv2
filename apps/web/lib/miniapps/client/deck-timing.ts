/**
 * Client-side load timing for the onboarding deck. Bundled to
 * public/creator-os/deck-timing.js by scripts/build-deck-timing.mjs — a
 * same-origin bundle under script-src 'self'.
 *
 * The server's `miniapp load` line measures the server: gate chain, render,
 * response. It cannot see what the surface actually did with the response —
 * how long the document took to arrive over the wire, when it first painted,
 * or how many bytes of image the page went on to pull. On the Messages
 * extension, where the whole problem is a resource budget, that second half
 * is the half that matters (docs/plans/onboarding-miniapp-upgrade.md
 * Stage 3).
 *
 * It reports once per page, after load, through `sendBeacon` to the page's
 * own URL — the same gated POST path every form here already uses, so there
 * is no new endpoint and no new authorization surface. Numbers only: the
 * standard Navigation/Paint/Resource timings, plus `deviceMemory`, which is
 * the coarse bucket the extension-kill hypothesis is actually about. No
 * identifiers, no URLs, no content.
 */

interface TimingReport {
  [key: string]: string;
}

/** Whole milliseconds, and only when the timing is real. */
function ms(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return String(Math.round(value));
}

function paintTime(name: string): number | undefined {
  const entries = performance.getEntriesByType?.("paint") ?? [];
  return entries.find((entry) => entry.name === name)?.startTime;
}

function collect(): TimingReport | null {
  const nav = performance.getEntriesByType?.("navigation")?.[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (!nav) return null;

  const report: TimingReport = {};
  const put = (key: string, value: string | null): void => {
    if (value !== null) report[key] = value;
  };

  // Server wait vs. transfer: a slow open is one or the other, and the
  // server line alone cannot tell them apart.
  put("ttfb_ms", ms(nav.responseStart - nav.requestStart));
  put("transfer_ms", ms(nav.responseEnd - nav.responseStart));
  put("dom_ms", ms(nav.domContentLoadedEventEnd - nav.startTime));
  put("load_ms", ms(nav.loadEventEnd - nav.startTime));
  put("fp_ms", ms(paintTime("first-paint")));
  put("fcp_ms", ms(paintTime("first-contentful-paint")));
  put("doc_bytes", ms(nav.encodedBodySize));

  // What the document then pulled. The deck's images are the variable cost
  // and the reason a panel full of previews can sink the surface, so they
  // are counted separately from everything else.
  const resources = (performance.getEntriesByType?.("resource") ??
    []) as PerformanceResourceTiming[];
  let imageBytes = 0;
  let imageCount = 0;
  let otherBytes = 0;
  for (const entry of resources) {
    const bytes = entry.encodedBodySize || 0;
    if (entry.initiatorType === "img") {
      imageBytes += bytes;
      imageCount += 1;
    } else {
      otherBytes += bytes;
    }
  }
  put("img_bytes", ms(imageBytes));
  put("img_count", ms(imageCount));
  put("other_bytes", ms(otherBytes));

  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  put("device_memory", typeof memory === "number" ? String(memory) : null);

  return report;
}

function send(): void {
  let report: TimingReport | null = null;
  try {
    report = collect();
  } catch {
    return;
  }
  if (!report || Object.keys(report).length === 0) return;

  const form = new FormData();
  form.set("action", "__timing");
  for (const [key, value] of Object.entries(report)) form.set(key, value);
  try {
    // Beacon so the report survives the owner tapping straight through to
    // the next panel; it must never delay or block navigation.
    navigator.sendBeacon?.(window.location.href, form);
  } catch {
    // Telemetry is never worth an error in the page.
  }
}

// `loadEventEnd` is only final once load has finished — one frame later.
if (document.readyState === "complete") {
  setTimeout(send, 0);
} else {
  window.addEventListener("load", () => setTimeout(send, 0), { once: true });
}
