/**
 * Shared jsdom shims for component tests (R-TQ-08/09). Import for side
 * effects from a test file carrying `// @vitest-environment jsdom` —
 * installs the browser APIs jsdom doesn't ship and marks the environment
 * React-act compatible.
 *
 * - `IS_REACT_ACT_ENVIRONMENT` lets `act`/`waitFor` drive effects.
 * - matchMedia/ResizeObserver/IntersectionObserver/scrollIntoView are
 *   viewport APIs several panels touch on mount.
 * - `HTMLCanvasElement.getContext` returns a universal no-op context:
 *   every method call returns the same callable proxy and every property
 *   read resolves to the proxy (numbers stringify/coerce to 0), so canvas
 *   painting code runs without a renderer.
 */
import { vi } from "vitest";

(globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;

function universalContext(): object {
  const callable = (): object => proxy;
  const proxy: object = new Proxy(callable, {
    get: (target, prop) => {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === "then") return undefined; // stay non-thenable
      const bag = target as unknown as Record<string | symbol, unknown>;
      if (bag[prop] !== undefined) return bag[prop];
      return universalContext();
    },
    apply: () => universalContext(),
    set: () => true,
    construct: () => universalContext(),
  });
  return proxy;
}

const canvas2d = universalContext();

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement
  ): unknown {
    return canvas2d;
  } as HTMLCanvasElement["getContext"];
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
}

if (typeof window !== "undefined") {
  window.matchMedia ??= vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  class ObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as Record<string, unknown>)["ResizeObserver"] ??= ObserverStub;
  (globalThis as Record<string, unknown>)["IntersectionObserver"] ??=
    ObserverStub;

  Element.prototype.scrollIntoView ??= () => {};
  window.scrollTo ??= (() => {}) as typeof window.scrollTo;
  URL.createObjectURL ??= () => "blob:stub";
  URL.revokeObjectURL ??= () => {};

  // EventSource is an SSE client the home page + CreateStudio open on mount.
  class EventSourceStub extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    readyState = EventSourceStub.CONNECTING;
    url = "";
    withCredentials = false;
    constructor(url: string | URL) {
      super();
      this.url = String(url);
      EventSourceStub.instances.push(this);
    }
    close() {
      this.readyState = EventSourceStub.CLOSED;
    }
    static instances: EventSourceStub[] = [];
  }
  (globalThis as Record<string, unknown>)["EventSource"] ??= EventSourceStub;
}
