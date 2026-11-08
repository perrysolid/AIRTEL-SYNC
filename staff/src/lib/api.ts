"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reads a backend endpoint and keeps it fresh: refetches every `poll` ms while the tab is visible and as soon
 * as the tab comes back, so a lead logged by a colleague or an order update shows up without reloading.
 */
export function useApi<T>(path: string | null, poll = 10_000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<number>();
  const live = useRef(path);
  live.current = path;

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (live.current !== path) return;
      setStatus(r.status);
      if (r.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Couldn't load this.");
      else {
        setData(j);
        setError(undefined);
      }
    } catch {
      setError("No connection. Retrying…");
    }
  }, [path]);

  useEffect(() => {
    setData(undefined);
    void load();
    if (!poll) return;
    const t = setInterval(() => document.visibilityState === "visible" && void load(), poll);
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [load, poll]);

  return { data, error, status, reload: load };
}

export async function send<T = unknown>(path: string, method: "POST" | "DELETE" | "PATCH", body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, data: j as T } : { ok: false, error: j.error ?? "That didn't work. Try again." };
  } catch {
    return { ok: false, error: "No connection. Try again." };
  }
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return `${same ? "Today" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

export const stageTone = (stage: string) => (stage === "Live" ? "bg-ok/10 text-ok" : stage.startsWith("Activating") ? "bg-marigold/20 text-[#7a5300]" : stage.includes("attention") ? "bg-brand-soft text-brand" : "bg-paper text-ink-soft");
