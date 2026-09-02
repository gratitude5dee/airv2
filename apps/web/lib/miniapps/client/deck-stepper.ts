/**
 * Stepper enhancement for multi-section onboarding slides. Bundled to
 * public/creator-os/deck-stepper.js by scripts/build-deck-stepper.mjs — a
 * same-origin bundle under script-src 'self'.
 *
 * A slide whose deck carries data-stepper renders its section panels as a
 * stepper (reactbits Stepper-style, first-party): numbered indicator
 * circles joined by connectors, completed steps get a green check, one
 * panel visible at a time with Back/Continue navigation. The server keeps
 * rendering every panel, so with no JS the sections simply stack — the
 * stepper only hides and reveals what is already there, and every form
 * inside keeps working untouched.
 */

const CHECK =
  '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function attachStepper(): void {
  const deck = document.querySelector<HTMLElement>(".deck[data-stepper]");
  if (!deck) return;
  const panels = Array.from(deck.children).filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.matches("section.panel")
  );
  if (panels.length < 2) return;

  const initial = Math.min(
    panels.length - 1,
    Math.max(0, Number(deck.getAttribute("data-stepper-active")) || 0)
  );

  const head = document.createElement("div");
  head.className = "stepper-head";
  const indicators: HTMLButtonElement[] = [];
  const lines: HTMLElement[] = [];
  panels.forEach((panel, i) => {
    if (i > 0) {
      const line = document.createElement("span");
      line.className = "stepper-line";
      line.setAttribute("aria-hidden", "true");
      line.appendChild(document.createElement("i"));
      lines.push(line);
      head.appendChild(line);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stepper-ind";
    button.textContent = String(i + 1);
    const label = panel.querySelector(".subhead")?.textContent ?? `step ${i + 1}`;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.addEventListener("click", () => show(i));
    indicators.push(button);
    head.appendChild(button);
  });

  const nav = document.createElement("div");
  nav.className = "stepper-nav";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ghost";
  back.textContent = "Previous";
  const forward = document.createElement("button");
  forward.type = "button";
  forward.textContent = "Continue";
  const spacer = document.createElement("span");
  spacer.className = "spacer";
  nav.append(back, spacer, forward);

  let current = initial;
  const updateUrl = (step: string, replace: boolean): void => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", step);
    const target = `${url.pathname}${url.search}${url.hash}`;
    if (replace) history.replaceState(null, "", target);
    else history.pushState(null, "", target);
  };
  const show = (
    index: number,
    historyMode: "push" | "replace" | "none" = "push"
  ): void => {
    current = Math.min(panels.length - 1, Math.max(0, index));
    panels.forEach((panel, i) =>
      panel.classList.toggle("stepper-panel-hidden", i !== current)
    );
    // Green checks mirror server-reported stage completion (data-step-done),
    // not position — a skipped or untouched stage never shows complete.
    indicators.forEach((button, i) => {
      const done = panels[i]?.hasAttribute("data-step-done") ?? false;
      button.classList.toggle("active", i === current);
      button.classList.toggle("complete", done);
      button.innerHTML = done ? CHECK : String(i + 1);
    });
    lines.forEach((line, i) =>
      line.classList.toggle(
        "complete",
        panels[i]?.hasAttribute("data-step-done") ?? false
      )
    );
    back.disabled = current === 0;
    // The last step's Continue hands off to the next slide when one exists.
    const next = document
      .querySelector("[data-swipe-next]")
      ?.getAttribute("data-swipe-next");
    if (current === panels.length - 1) {
      forward.textContent = next ? "Next slide" : "Continue";
      forward.style.visibility = next ? "visible" : "hidden";
    } else {
      forward.textContent = "Continue";
      forward.style.visibility = "visible";
    }
    const step = panels[current]?.dataset["step"];
    if (step && historyMode !== "none") {
      updateUrl(step, historyMode === "replace");
    }
  };
  back.addEventListener("click", () => show(current - 1));
  forward.addEventListener("click", () => {
    if (current === panels.length - 1) {
      const next = document
        .querySelector("[data-swipe-next]")
        ?.getAttribute("data-swipe-next");
      if (next) window.location.assign(next);
      return;
    }
    show(current + 1);
  });
  window.addEventListener("popstate", () => {
    const step = new URL(window.location.href).searchParams.get("step");
    const index = step
      ? panels.findIndex((panel) => panel.dataset["step"] === step)
      : -1;
    if (index >= 0) show(index, "none");
  });
  document.addEventListener("deck:navigate", (event) => {
    const dir = (event as CustomEvent<{ dir?: number }>).detail?.dir;
    if (dir === 1 && current < panels.length - 1) {
      event.preventDefault();
      show(current + 1);
    } else if (dir === -1 && current > 0) {
      event.preventDefault();
      show(current - 1);
    }
  });

  const first = panels[0];
  const last = panels[panels.length - 1];
  if (!first || !last) return;
  deck.insertBefore(head, first);
  last.insertAdjacentElement("afterend", nav);
  show(initial, "replace");
}

attachStepper();
