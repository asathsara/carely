"use client";

import { useCallback, useEffect, useState } from "react";

/** Native-fetch polling that stops in hidden tabs and catches up on focus. */
export function useVisiblePolling<T>(url: string, intervalMs = 30_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to refresh.");
      setData((await response.json()) as T);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh.");
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, intervalMs);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [intervalMs, refresh]);
  return { data, error, loading, refresh };
}
