/**
 * Cinematic welcome intro for the onboarding deck. Bundled to
 * public/creator-os/intro-cinematic.js by scripts/build-intro-cinematic.mjs —
 * a same-origin bundle under script-src 'self' whose only powers are
 * pointer/keyboard handling on the CTA, toggling CSS state on the intro
 * container, playing the first-party intro film, and submitting the
 * server-rendered "welcome done" form when the film ends.
 *
 * Sequence: black stage + wordmark + one button → press-and-hold escalates
 * shake, glow and haptics for ~5s → flash to black → the film fades/scales
 * in → on `ended` the hidden done-form submits and the server redirects to
 * the next slide. A plain tap/click (or Enter/Space) runs the same
 * escalation without needing to hold. Inert when no intro container exists.
 */

const HOLD_MS = 5000;
const FLASH_MS = 420;
const FILM_FALLBACK_MS = 90_000;

type Phase = "idle" | "charging" | "film" | "done";

function attachIntro(): void {
  const root = document.querySelector<HTMLElement>("[data-intro]");
  if (!root) return;
  const cta = root.querySelector<HTMLButtonElement>(".cine-cta");
  const video = root.querySelector<HTMLVideoElement>("video.cine-film");
  const form = root.querySelector<HTMLFormElement>(".cine-done form");
  if (!cta || !video || !form) return;

  const reduced =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  root.classList.add("is-ready");
  if (reduced) root.classList.add("is-reduced");

  let phase: Phase = "idle";
  let startedAt = 0;
  let frame = 0;
  let holding = false;
  let nextPulseAt = 0;
  let fallback = 0;

  const setIntensity = (value: number): void => {
    root.style.setProperty("--cine-intensity", value.toFixed(3));
  };

  const finish = (): void => {
    if (phase === "done") return;
    phase = "done";
    window.clearTimeout(fallback);
    if (canVibrate) navigator.vibrate(0);
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.submit();
  };

  const startFilm = (): void => {
    if (phase !== "charging") return;
    phase = "film";
    holding = false;
    cta.disabled = true;
    root.classList.remove("is-charging");
    root.classList.add("is-flash");
    setIntensity(0);
    if (canVibrate) navigator.vibrate([40, 30, 80]);
    video.addEventListener("ended", finish, { once: true });
    video.addEventListener("error", finish, { once: true });
    window.setTimeout(() => {
      root.classList.remove("is-flash");
      root.classList.add("is-film");
      const played = video.play();
      if (played && typeof played.catch === "function") {
        played.catch(() => finish());
      }
      // If the film never fires `ended` (stalled network, decode failure),
      // still move the owner along — its duration once known, else a cap.
      const budget =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration * 1000 + 4000
          : FILM_FALLBACK_MS;
      fallback = window.setTimeout(finish, budget);
    }, FLASH_MS);
  };

  const tick = (now: number): void => {
    if (phase !== "charging") return;
    const progress = Math.min(1, (now - startedAt) / HOLD_MS);
    // Ease-in so the first second is a tremor and the last is a quake.
    setIntensity(progress * progress);
    if (canVibrate && now >= nextPulseAt) {
      const strength = Math.round(12 + progress * 60);
      navigator.vibrate(strength);
      nextPulseAt = now + Math.max(50, 360 - progress * 300);
    }
    if (progress >= 1) {
      startFilm();
      return;
    }
    frame = window.requestAnimationFrame(tick);
  };

  const begin = (): void => {
    if (phase !== "idle") return;
    if (reduced) {
      phase = "charging";
      startFilm();
      return;
    }
    phase = "charging";
    startedAt = performance.now();
    nextPulseAt = startedAt;
    root.classList.add("is-charging");
    frame = window.requestAnimationFrame(tick);
  };

  const pressIn = (): void => {
    holding = true;
    root.classList.add("is-pressed");
    begin();
  };
  const pressOut = (): void => {
    // Releasing keeps the escalation running: a tap counts as a full
    // press-and-hold so the sequence is one gesture on any input.
    holding = false;
    root.classList.remove("is-pressed");
  };

  cta.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pressIn();
  });
  cta.addEventListener("pointerup", pressOut);
  cta.addEventListener("pointercancel", pressOut);
  cta.addEventListener("pointerleave", () => {
    if (holding) pressOut();
  });
  cta.addEventListener("click", (event) => {
    event.preventDefault();
    begin();
  });
  cta.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    pressIn();
  });
  cta.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    pressOut();
  });

  window.addEventListener("pagehide", () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(fallback);
  });
}

attachIntro();
