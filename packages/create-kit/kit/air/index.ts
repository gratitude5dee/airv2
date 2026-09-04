"use client";

/**
 * Air runtime for Kit mini-apps: theme/lite/reduced-motion signals and the
 * Apps API state client. This is the only place a Kit component may talk to
 * the network, and it only ever talks to the app's own origin.
 *
 * State contract (apps/web/app/api/apps/v1/state/route.ts):
 *   GET  /api/apps/v1/state  → { state }   (guests get {} )
 *   PUT  /api/apps/v1/state  → { ok }      owner only; body ≤ 256 KiB JSON
 * Browser storage is never used: every mini-app shares the mini origin.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const STATE_PATH = "/api/apps/v1/state";
export const STATE_MAX_BYTES = 256 * 1024;

export type ThemeId = "atmosphere" | "pixel";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

function root(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

/** Theme id from `<html data-theme>`; defaults to atmosphere. */
export function useTheme(): ThemeId {
  const [theme, setTheme] = useState<ThemeId>("atmosphere");
  useEffect(() => {
    const el = root();
    if (!el) return;
    const read = () => setTheme(el.dataset.theme === "pixel" ? "pixel" : "atmosphere");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

/**
 * Lite surface: `<html data-lite="1">` (set by the shell for low-end webviews)
 * or the user asked for reduced data. Lite means no blur, no WebGL, no fixed
 * backgrounds, static fallbacks for ambient motion. SSR renders lite=false.
 */
export function useLite(): boolean {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    const el = root();
    if (!el) return;
    const read = () => {
      const saveData =
        typeof navigator !== "undefined" &&
        (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
      setLite(el.dataset.lite === "1" || saveData);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-lite"] });
    return () => mo.disconnect();
  }, []);
  return lite;
}

/** `prefers-reduced-motion: reduce`, live. SSR renders false. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return reduced;
}

export type AirStateStatus = "loading" | "ready" | "saving" | "error";

export interface AirState<T> {
  readonly state: T;
  readonly status: AirStateStatus;
  /** null until a write has been attempted; false once the server said 403 (guest). */
  readonly canWrite: boolean | null;
  readonly error: string | null;
  /** Replace the whole state. Resolves false when the write was rejected. */
  readonly save: (next: T) => Promise<boolean>;
  /** Functional update over the last known state. */
  readonly update: (fn: (prev: T) => T) => Promise<boolean>;
  readonly reload: () => Promise<void>;
}

export interface AirStateOptions {
  /** Override the endpoint (tests, Functions proxies). Must stay same-origin. */
  readonly path?: string;
  readonly fetch?: typeof fetch;
}

function byteLength(text: string): number {
  return typeof TextEncoder === "undefined" ? text.length : new TextEncoder().encode(text).length;
}

/**
 * Owner-writable, guest-readable app state. One JSON document per
 * (owner, app, resource); the server enforces the 256 KiB cap and the
 * owner-only write rule — this client just mirrors them so the UI can say why.
 */
export function useAirState<T extends object>(initial: T, options: AirStateOptions = {}): AirState<T> {
  const path = options.path ?? STATE_PATH;
  const fetchRef = useRef(options.fetch);
  fetchRef.current = options.fetch;
  const [state, setState] = useState<T>(initial);
  const [status, setStatus] = useState<AirStateStatus>("loading");
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<T>(initial);
  latest.current = state;
  const initialRef = useRef<T>(initial);

  const reload = useCallback(async () => {
    const doFetch = fetchRef.current ?? (typeof fetch === "function" ? fetch : undefined);
    if (!doFetch) return;
    setStatus("loading");
    try {
      const res = await doFetch(path, { credentials: "same-origin", headers: { accept: "application/json" } });
      if (!res.ok) {
        setError(res.status === 401 ? "Session expired. Reopen the app from Messages." : `Couldn't load (${res.status}).`);
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { state?: unknown };
      const loaded = data.state && typeof data.state === "object" ? (data.state as T) : initialRef.current;
      setState(Object.keys(loaded).length === 0 ? initialRef.current : loaded);
      setError(null);
      setStatus("ready");
    } catch {
      setError("Couldn't reach the app.");
      setStatus("error");
    }
  }, [path]);

  const save = useCallback(
    async (next: T): Promise<boolean> => {
      const doFetch = fetchRef.current ?? (typeof fetch === "function" ? fetch : undefined);
      if (!doFetch) return false;
      const body = JSON.stringify(next);
      if (byteLength(body) > STATE_MAX_BYTES) {
        setError("Too much to save (256 KiB limit).");
        return false;
      }
      const prev = latest.current;
      setState(next);
      setStatus("saving");
      try {
        const res = await doFetch(path, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body,
        });
        if (res.ok) {
          setCanWrite(true);
          setError(null);
          setStatus("ready");
          return true;
        }
        setState(prev);
        setStatus("ready");
        setError(
          res.status === 403
            ? "Guests are read-only."
            : res.status === 413
              ? "Too much to save (256 KiB limit)."
              : res.status === 401
                ? "Session expired. Reopen the app from Messages."
                : `Couldn't save (${res.status}).`
        );
        if (res.status === 403) setCanWrite(false);
        return false;
      } catch {
        setState(prev);
        setStatus("error");
        setError("Couldn't reach the app.");
        return false;
      }
    },
    [path]
  );

  const update = useCallback((fn: (prev: T) => T) => save(fn(latest.current)), [save]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, status, canWrite, error, save, update, reload };
}
