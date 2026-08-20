"use client";

/**
 * D6: stale-while-revalidate for /home panels. A module-level cache keyed by
 * panel name lets a remounted (or re-activated) panel paint its last data
 * instantly while a background fetch refreshes it. Fetchers resolve to the
 * fresh value, or `undefined` to keep whatever is already shown (failures).
 */
import { useCallback, useEffect, useRef, useState } from "react";

const cache = new Map<string, unknown>();

export function readSwrCache<T>(key: string): T | null {
  const hit = cache.get(key) as T | undefined;
  return hit === undefined ? null : hit;
}

export function writeSwrCache<T>(key: string, value: T | null): void {
  if (value === null) cache.delete(key);
  else cache.set(key, value);
}

/** Test hook — panels never need this. */
export function clearSwrCache(): void {
  cache.clear();
}

export function useStaleWhileRevalidate<T>(
  key: string,
  active: boolean,
  fetcher: () => Promise<T | undefined>
): {
  data: T | null;
  setData: (update: T | null | ((current: T | null) => T | null)) => void;
  refresh: () => Promise<void>;
} {
  const [data, setDataState] = useState<T | null>(() => readSwrCache<T>(key));
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  // Generation counter: bumping it invalidates any in-flight fetch, so a
  // deactivated/unmounted panel never applies a late response.
  const genRef = useRef(0);

  const setData = useCallback(
    (update: T | null | ((current: T | null) => T | null)) => {
      setDataState((current) => {
        const next =
          typeof update === "function"
            ? (update as (c: T | null) => T | null)(current)
            : update;
        writeSwrCache(key, next);
        return next;
      });
    },
    [key]
  );

  const refresh = useCallback(async () => {
    const gen = ++genRef.current;
    const fresh = await fetcherRef.current();
    if (gen !== genRef.current || fresh === undefined) return;
    writeSwrCache(key, fresh);
    setDataState(fresh);
  }, [key]);

  useEffect(() => {
    if (active) void refresh();
    // genRef is a monotonic generation counter, not a DOM ref — bumping the
    // latest value on cleanup is what invalidates in-flight fetches.
    const gen = genRef;
    return () => {
      gen.current++;
    };
  }, [active, refresh]);

  return { data, setData, refresh };
}
