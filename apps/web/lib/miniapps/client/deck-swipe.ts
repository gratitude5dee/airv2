/**
 * iPhone-style swipe navigation for the onboarding deck. Bundled to
 * public/creator-os/deck-swipe.js by scripts/build-deck-swipe.mjs — a
 * same-origin bundle under script-src 'self' whose only power is
 * navigating to the previous/next slide hrefs the server rendered.
 *
 * Touch-only on purpose: a horizontal touch swipe anywhere on the slide
 * goes back/forward, except inside regions that own their own horizontal
 * gestures (the photo-booth carousel, the booth pager, media and form
 * controls). Also keeps the booth pager's segmented control in sync with
 * its scroll position.
 */

const IGNORE =
  ".pager, .dcar, .identity-booth, input, textarea, select, video, [data-noswipe]";

function attachSwipe(): void {
  const frame = document.querySelector<HTMLElement>("[data-swipe-prev], [data-swipe-next]");
  if (!frame) return;
  const prev = frame.getAttribute("data-swipe-prev");
  const next = frame.getAttribute("data-swipe-next");
  let start: { x: number; y: number; ok: boolean } | null = null;

  document.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) {
        start = null;
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      start = {
        x: touch.clientX,
        y: touch.clientY,
        ok: !target?.closest(IGNORE),
      };
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (event) => {
      const from = start;
      start = null;
      const touch = event.changedTouches[0];
      if (!from || !from.ok || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      // A deliberate horizontal swipe: far enough, and clearly sideways.
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 2) return;
      const href = dx < 0 ? next : prev;
      if (href) window.location.assign(href);
    },
    { passive: true }
  );
}

/** Highlight the segmented-control tab matching the pager's visible pane. */
function attachPagerSync(): void {
  const pager = document.querySelector<HTMLElement>(".pager");
  const tabs = Array.from(document.querySelectorAll<HTMLAnchorElement>(".seg a"));
  if (!pager || tabs.length === 0) return;
  const sync = (): void => {
    const index = Math.round(
      pager.scrollLeft / Math.max(1, pager.clientWidth)
    );
    tabs.forEach((tab, i) => tab.classList.toggle("on", i === index));
  };
  pager.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  sync();
}

attachSwipe();
attachPagerSync();
