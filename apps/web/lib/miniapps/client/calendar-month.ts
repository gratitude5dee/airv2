import { stripRowFor, staggerFor } from "@/lib/miniapps/apps/calendar-mosaic";

export interface InterceptInput {
  tag: string;
  classList: string[];
  button: number;
  modifiers: boolean;
  closestClasses: string[];
}

export function shouldIntercept(input: InterceptInput): boolean {
  if (input.button !== 0 || input.modifiers) return false;
  const excluded = new Set([
    "mo-add",
    "mo-dot",
    "mo-chip",
    "mo-nav",
    "mo-persona",
    "mo-close-link",
    "more",
  ]);
  if (input.closestClasses.some((name) => excluded.has(name))) return false;
  return input.closestClasses.includes("mo-tile");
}

export function arrowTarget(
  cells: { tile: boolean; week: number; column: number }[],
  index: number,
  key: string
): number | null {
  if (index < 0 || index >= cells.length) return null;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const step = key === "ArrowLeft" ? -1 : 1;
    for (
      let next = index + step;
      next >= 0 && next < cells.length;
      next += step
    ) {
      if (cells[next]?.tile) return next;
    }
    return null;
  }
  if (key === "Home" || key === "End") {
    const week = cells[index]?.week;
    if (week === undefined) return null;
    const row = cells
      .map((cell, cellIndex) => ({ ...cell, index: cellIndex }))
      .filter((cell) => cell.tile && cell.week === week);
    return row[key === "Home" ? 0 : row.length - 1]?.index ?? null;
  }
  if (key !== "ArrowUp" && key !== "ArrowDown") return null;
  const step = key === "ArrowUp" ? -7 : 7;
  const targetIndex = index + step;
  const target = cells[targetIndex];
  if (!target) return null;
  if (target.tile) return targetIndex;
  const nearest = cells
    .map((cell, cellIndex) => ({ ...cell, index: cellIndex }))
    .filter((cell) => cell.tile && cell.week === target.week)
    .sort(
      (a, b) =>
        Math.abs(a.column - target.column) -
        Math.abs(b.column - target.column)
    );
  return nearest[0]?.index ?? null;
}

export type State = { open: string | null; animating: boolean };

export type Action =
  | { type: "open"; day: string }
  | { type: "close" }
  | { type: "animEnd" }
  | { type: "popstate"; day: string | null };

export type Effect =
  | { kind: "openStrip"; day: string }
  | { kind: "closeStrip"; day: string }
  | { kind: "replaceUrl"; day: string | null }
  | { kind: "focusTile"; day: string };

function open(
  state: State,
  day: string,
  replaceUrl: boolean
): { state: State; effects: Effect[] } {
  if (state.open === day) {
    return close(state, replaceUrl);
  }
  if (state.open) {
    return {
      state: { open: day, animating: true },
      effects: [
        { kind: "closeStrip", day: state.open },
        { kind: "openStrip", day },
        ...(replaceUrl ? [{ kind: "replaceUrl", day }] : []),
      ] as Effect[],
    };
  }
  return {
    state: { open: day, animating: true },
    effects: [
      { kind: "openStrip", day },
      ...(replaceUrl ? [{ kind: "replaceUrl", day }] : []),
    ] as Effect[],
  };
}

function close(
  state: State,
  replaceUrl: boolean
): { state: State; effects: Effect[] } {
  if (!state.open) return { state, effects: [] };
  return {
    state: { open: null, animating: true },
    effects: [
      { kind: "closeStrip", day: state.open },
      ...(replaceUrl ? [{ kind: "replaceUrl", day: null }] : []),
      { kind: "focusTile", day: state.open },
    ] as Effect[],
  };
}

export function next(
  state: State,
  action: Action
): { state: State; effects: Effect[] } {
  if (action.type === "animEnd") {
    return { state: { ...state, animating: false }, effects: [] };
  }
  if (action.type === "popstate") {
    return action.day === null
      ? close(state, false)
      : open(state, action.day, false);
  }
  if (state.animating) return { state, effects: [] };
  if (action.type === "close") return close(state, true);
  return open(state, action.day, true);
}

function dayOf(element: Element): string | null {
  return element.getAttribute("data-day");
}

function tiles(grid: Element): HTMLElement[] {
  return Array.from(grid.querySelectorAll<HTMLElement>(".mo-tile"));
}

function tileFor(grid: Element, day: string): HTMLElement | null {
  return tiles(grid).find((tile) => dayOf(tile) === day) ?? null;
}

function stripFor(grid: Element, day: string): HTMLElement | null {
  return (
    Array.from(grid.querySelectorAll<HTMLElement>(".mo-strip")).find(
      (strip) => strip.dataset["for"] === day
    ) ?? null
  );
}

function closeButton(doc: Document): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "mo-close";
  button.setAttribute("aria-label", "Close day");
  button.textContent = "×";
  return button;
}

function adoptServerStrip(doc: Document, grid: Element): void {
  for (const link of Array.from(
    grid.querySelectorAll<HTMLAnchorElement>(".mo-strip .mo-close")
  )) {
    const button = closeButton(doc);
    link.replaceWith(button);
  }
}

function rowIndex(tile: Element, grid: Element): number {
  const row = tile.closest(".mo-week");
  return row ? Array.from(grid.querySelectorAll(".mo-week")).indexOf(row) : 0;
}

function createStrip(
  mosaic: HTMLElement,
  grid: HTMLElement,
  day: string
): HTMLElement | null {
  const template = mosaic.querySelector<HTMLTemplateElement>(
    `.mo-day[data-day="${day}"]`
  );
  const tile = tileFor(grid, day);
  if (!template || !tile) return null;
  const strip = document.createElement("li");
  strip.className = "mo-strip";
  strip.setAttribute("role", "region");
  strip.setAttribute("aria-label", day);
  strip.dataset["for"] = day;
  strip.append(closeButton(mosaic.ownerDocument));
  strip.append(template.content.cloneNode(true));
  const rows = Array.from(grid.querySelectorAll(".mo-week"));
  const index = stripRowFor(rowIndex(tile, grid), rows.length);
  const anchor = rows[index];
  if (anchor) grid.insertBefore(strip, anchor);
  else grid.append(strip);
  return strip;
}

function replaceUrl(win: Window, day: string | null): void {
  const url = new URL(win.location.href);
  if (day) url.searchParams.set("day", day);
  else url.searchParams.delete("day");
  win.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function prefersReducedMotion(win: Window): boolean {
  return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateOpen(strip: HTMLElement, win: Window): void {
  const chips = Array.from(strip.querySelectorAll<HTMLElement>(".mo-chip"));
  if (!strip.animate || prefersReducedMotion(win)) {
    strip.style.opacity = "1";
    return;
  }
  strip.style.overflow = "hidden";
  const height = strip.getBoundingClientRect().height;
  const animation = strip.animate(
    [
      { height: "0px", opacity: 0 },
      { height: `${height}px`, opacity: 1 },
    ],
    { duration: 300, easing: "ease-out", fill: "forwards" }
  );
  for (const [index, chip] of chips.entries()) {
    chip.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 220,
        delay: staggerFor(index, 0),
        easing: "ease-out",
        fill: "forwards",
      }
    );
  }
  animation.finished
    .then(() => {
      strip.style.height = "";
      strip.style.overflow = "";
    })
    .catch(() => undefined);
}

function animateClose(
  strip: HTMLElement,
  win: Window,
  remove: () => void
): void {
  if (!strip.animate || prefersReducedMotion(win)) {
    strip.style.opacity = "0";
    remove();
    return;
  }
  const animation = strip.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: 220, easing: "ease-in", fill: "forwards" }
  );
  animation.finished.then(remove).catch(remove);
}

export function mount(doc: Document, win: Window): void {
  const mosaic = doc.querySelector<HTMLElement>(".mosaic");
  const grid = mosaic?.querySelector<HTMLElement>(".mo-grid");
  if (!mosaic || !grid) return;
  adoptServerStrip(doc, grid);
  let state: State = {
    open: mosaic.dataset["open"] ?? null,
    animating: false,
  };
  const originalTilts = new WeakMap<HTMLElement, string>();
  for (const tile of tiles(grid)) {
    originalTilts.set(tile, tile.style.getPropertyValue("--tilt"));
  }

  const setTileOpen = (day: string, isOpen: boolean): void => {
    const tile = tileFor(grid, day);
    if (!tile) return;
    tile.classList.toggle("is-open", isOpen);
    if (isOpen) {
      if (!originalTilts.has(tile)) {
        originalTilts.set(tile, tile.style.getPropertyValue("--tilt"));
      }
      tile.style.setProperty("--tilt", "0deg");
      tile.setAttribute("aria-expanded", "true");
    } else {
      const original = originalTilts.get(tile) ?? "";
      if (original) tile.style.setProperty("--tilt", original);
      else tile.style.removeProperty("--tilt");
      tile.removeAttribute("aria-expanded");
    }
  };

  const openStrip = (day: string): void => {
    stripFor(grid, day)?.remove();
    const strip = createStrip(mosaic, grid, day);
    const tile = tileFor(grid, day);
    if (!strip || !tile) return;
    setTileOpen(day, true);
    mosaic.dataset["open"] = day;
    mosaic.classList.add("is-dim");
    animateOpen(strip, win);
  };

  const closeStrip = (day: string): void => {
    const strip = stripFor(grid, day);
    if (strip) animateClose(strip, win, () => strip.remove());
    setTileOpen(day, false);
    if (mosaic.dataset["open"] === day) {
      delete mosaic.dataset["open"];
      mosaic.classList.remove("is-dim");
    }
  };

  const focusTile = (day: string): void => {
    tileFor(grid, day)?.focus();
  };

  const dispatch = (action: Action): void => {
    const result = next(state, action);
    state = result.state;
    let gap = 0;
    for (const effect of result.effects) {
      if (effect.kind === "closeStrip") {
        closeStrip(effect.day);
        gap = 60;
      } else if (effect.kind === "openStrip") {
        if (gap) {
          const day = effect.day;
          win.setTimeout(() => openStrip(day), gap);
          gap = 0;
        } else {
          openStrip(effect.day);
        }
      } else if (effect.kind === "replaceUrl") {
        replaceUrl(win, effect.day);
      } else {
        focusTile(effect.day);
      }
    }
    if (result.effects.some((effect) => effect.kind === "openStrip")) {
      win.setTimeout(() => dispatch({ type: "animEnd" }), 300);
    } else if (result.effects.some((effect) => effect.kind === "closeStrip")) {
      win.setTimeout(() => dispatch({ type: "animEnd" }), 220);
    }
  };

  grid.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest("a, button");
    if (!control || !grid.contains(control)) return;
    if (control.classList.contains("mo-close")) {
      event.preventDefault();
      const strip = control.closest<HTMLElement>(".mo-strip");
      const day = strip?.dataset["for"] ?? state.open;
      if (day) dispatch({ type: "close" });
      return;
    }
    const closest = control.classList;
    if (
      !shouldIntercept({
        tag: control.tagName,
        classList: Array.from(control.classList),
        button: event.button,
        modifiers: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
        closestClasses: Array.from(closest),
      })
    )
      return;
    const day = dayOf(control);
    if (!day) return;
    event.preventDefault();
    dispatch({ type: "open", day });
  });

  mosaic.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const tile = target?.closest<HTMLElement>(".mo-tile");
    if (event.key === "Escape") {
      event.preventDefault();
      dispatch({ type: "close" });
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      const navs = Array.from(
        mosaic.querySelectorAll<HTMLAnchorElement>(".mo-nav")
      );
      const nav = event.key === "PageUp" ? navs[0] : navs.at(-1);
      if (nav?.href) {
        event.preventDefault();
        win.location.assign(nav.href);
      }
      return;
    }
    if (!tile) return;
    const cells = Array.from(grid.querySelectorAll<HTMLElement>(".mo-cell"));
    const weeks = Array.from(grid.querySelectorAll(".mo-week"));
    const metadata = cells.map((cell) => {
      const row = cell.closest(".mo-week");
      return {
        tile: cell.classList.contains("mo-tile") && !cell.classList.contains("is-muted"),
        week: row ? weeks.indexOf(row) : -1,
        column: row ? Array.from(row.querySelectorAll(".mo-cell")).indexOf(cell) : -1,
      };
    });
    const index = cells.indexOf(tile);
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const day = dayOf(tile);
      if (day) dispatch({ type: "open", day });
      return;
    }
    const targetIndex = arrowTarget(metadata, index, event.key);
    const destination = targetIndex === null ? null : cells[targetIndex];
    if (destination?.classList.contains("mo-tile")) {
      event.preventDefault();
      destination.focus();
    }
  });

  doc.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      state.open &&
      !mosaic.contains(event.target as Node)
    ) {
      event.preventDefault();
      dispatch({ type: "close" });
    }
  });

  win.addEventListener("popstate", () => {
    const day = new URL(win.location.href).searchParams.get("day");
    dispatch({ type: "popstate", day });
  });
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  mount(document, window);
}
