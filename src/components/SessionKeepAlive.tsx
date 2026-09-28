"use client";

import { useEffect } from "react";

const MIN_INTERVAL_MS = 60 * 60 * 1000; // at most once per hour from this tab
const STORAGE_KEY = "todo_session_refreshed_at";

function shouldRefresh(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < MIN_INTERVAL_MS) {
      return false;
    }
  } catch {
    // sessionStorage unavailable — still attempt refresh
  }
  return true;
}

function markRefreshed(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

async function refreshSession(): Promise<void> {
  if (!shouldRefresh()) return;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (res.ok) markRefreshed();
  } catch {
    // offline / transient — ignore
  }
}

/** Extends the login cookie while the app is actively used. */
export function SessionKeepAlive() {
  useEffect(() => {
    void refreshSession();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    };
    const onFocus = () => {
      void refreshSession();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
