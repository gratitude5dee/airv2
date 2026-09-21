/**
 * Tap feedback for the server-rendered deck. Bundled to
 * public/creator-os/deck-pending.js by scripts/build-deck-pending.mjs — a
 * same-origin bundle under script-src 'self'.
 *
 * Every control here is a real link or a real form post, so each one costs a
 * round trip to the owner's box before anything on screen changes. Without a
 * signal that the tap landed, that reads as a dead button and invites a
 * second tap — which on a form is a duplicate submit. This marks the control
 * the owner actually pressed as busy and blocks the repeat; it changes
 * nothing about what is submitted, and with no JS the page behaves exactly
 * as it does now.
 */

/** Controls that must stay instant: they never leave the page. */
const INERT = "[data-noswipe] .cine-cta, .cine-sound, summary";

function markBusy(el: HTMLElement): void {
  el.classList.add("is-busy");
  el.setAttribute("aria-busy", "true");
}

function attach(): void {
  let settled = false;
  // Lets the stylesheet hide the no-JS fallbacks (the upload tiles' submit
  // buttons) only where something is actually there to replace them.
  document.documentElement.classList.add("js");

  // An upload is one decision — "this photo" — so picking the file is the
  // whole interaction. Without this the owner picks a photo and then has to
  // find a second button to commit it, which is where uploads get abandoned.
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type !== "file" || !input.hasAttribute("data-autosubmit")) return;
    if (!input.files || input.files.length === 0) return;
    const form = input.form;
    if (!form) return;
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.submit();
  });

  // A page restored from the back/forward cache must not still look busy.
  window.addEventListener("pageshow", () => {
    settled = false;
    for (const el of document.querySelectorAll<HTMLElement>(".is-busy")) {
      el.classList.remove("is-busy");
      el.removeAttribute("aria-busy");
    }
  });

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
      if (settled) {
        // A second submit while the first is in flight would double the
        // action — one upload, one generation, one charge, twice.
        event.preventDefault();
        return;
      }
      settled = true;
      const submitter = (event as SubmitEvent).submitter;
      markBusy(submitter instanceof HTMLElement ? submitter : form);
    },
    true
  );

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || event.defaultPrevented) return;
    const link = target.closest("a[href]");
    if (!(link instanceof HTMLAnchorElement) || link.matches(INERT)) return;
    if (link.target === "_blank" || link.getAttribute("href")?.startsWith("#")) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    markBusy(link);
  });
}

attach();
