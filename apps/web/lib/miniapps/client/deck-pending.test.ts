// @vitest-environment jsdom
/**
 * deck-pending behaviour (R-TQ-08): the self-attach script marks forms and
 * links busy so a double-submit or a back-navigation can't fire twice, and
 * recovers if the browser never navigated. Exercises the real DOM listeners
 * the module installs at import time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Side-effect import: the bundle attaches its listeners when it loads —
// it is a script, not a module, so a dynamic import() would not typecheck.
import "./deck-pending";

function submitForm(form: HTMLFormElement): boolean {
  return form.dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true })
  );
}

beforeEach(() => {
  // The module allows one in-flight submission per page load — a pageshow
  // (bfcache restore) is the reset a real navigation would have provided.
  window.dispatchEvent(new Event("pageshow"));
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("deck-pending busy state", () => {
  it("marks the submitting form busy and swallows a second submit", () => {
    const form = document.createElement("form");
    document.body.appendChild(form);

    expect(submitForm(form)).toBe(true);
    expect(form.classList.contains("is-busy")).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");

    // Second dispatch hits the guard: preventDefault → dispatchEvent false.
    expect(submitForm(form)).toBe(false);
  });

  it("adds the js class to the document root", () => {
    expect(document.documentElement.classList.contains("js")).toBe(true);
  });

  it("clears the busy state on pageshow (bfcache restore)", () => {
    const form = document.createElement("form");
    document.body.appendChild(form);
    submitForm(form);
    expect(form.classList.contains("is-busy")).toBe(true);

    window.dispatchEvent(new Event("pageshow"));
    expect(form.classList.contains("is-busy")).toBe(false);
    expect(form.getAttribute("aria-busy")).toBeNull();
  });

  it("recovers a stuck submission after the navigation timeout", () => {
    vi.useFakeTimers();
    const form = document.createElement("form");
    document.body.appendChild(form);
    submitForm(form);
    expect(form.classList.contains("is-busy")).toBe(true);

    vi.advanceTimersByTime(30_000);
    expect(form.classList.contains("is-busy")).toBe(false);
  });

  it("marks clicked links busy unless they are inert or fragment links", () => {
    const link = document.createElement("a");
    link.href = "https://example.test/next";
    const fragment = document.createElement("a");
    fragment.href = "#";
    const blank = document.createElement("a");
    blank.href = "https://example.test/other";
    blank.target = "_blank";
    const inert = document.createElement("a");
    inert.href = "https://example.test/inert";
    inert.className = "cine-sound";
    document.body.append(link, fragment, blank, inert);

    link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    fragment.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    blank.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    inert.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(link.classList.contains("is-busy")).toBe(true);
    expect(fragment.classList.contains("is-busy")).toBe(false);
    expect(blank.classList.contains("is-busy")).toBe(false);
    expect(inert.classList.contains("is-busy")).toBe(false);
  });

  it("submits the enclosing form when a data-autosubmit file input changes", () => {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("data-autosubmit", "");
    form.appendChild(input);
    document.body.appendChild(form);
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => {});
    Object.defineProperty(input, "files", { value: [{}] });
    try {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      expect(requestSubmit).toHaveBeenCalledTimes(1);
    } finally {
      requestSubmit.mockRestore();
    }
  });
});
