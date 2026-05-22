import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Polls `fetcher` on mount and every `intervalMs` thereafter.
 * Returns the latest value, a manual refresh function, and the timestamp
 * of the last successful fetch.
 *
 * - Skips updates if the component unmounts mid-fetch
 * - Silently retains the previous value on failure (so transient backend hiccups
 *   don't blank the page)
 * - Re-fetches when the browser tab becomes visible again (lets the user jump
 *   between tabs and see fresh data immediately instead of waiting for the
 *   next polling tick)
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs = 15_000,
): { data: T | null; refresh: () => Promise<void>; lastUpdated: Date | null } {
  const [data, setData] = useState<T | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetcher();
      if (mountedRef.current) {
        setData(next);
        setLastUpdated(new Date());
      }
    } catch {
      // keep previous value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    intervalRef.current = window.setInterval(refresh, intervalMs);

    // Refetch when tab returns to foreground — feels much more "live"
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, refresh, lastUpdated };
}
