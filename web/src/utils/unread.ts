import { useEffect, useState } from "react";
import api from "../api/api";

export interface UnreadCounts {
  /** Unread activity (likes, comments, follows…) — excludes messages. */
  activity: number;
  /** Unread "new message" notifications. */
  messages: number;
}

const POLL_MS = 30_000;
let state: UnreadCounts = { activity: 0, messages: 0 };
const listeners = new Set<(c: UnreadCounts) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inflight = false;

function emit(next: UnreadCounts) {
  state = next;
  listeners.forEach((l) => l(state));
}

export async function refreshUnreadCounts() {
  if (inflight || !localStorage.getItem("accessToken")) return;
  inflight = true;
  try {
    const [notif, msgs] = await Promise.all([
      api.get("/notifications/unread-count"),
      api.get("/messages/unread-count").catch(() => null),
    ]);
    const data = notif.data;
    const byType: Record<string, number> = data?.byType ?? {};
    let activity = 0;
    for (const [type, n] of Object.entries(byType)) {
      if (type !== "message") activity += n;
    }
    // Older backends only return { count }.
    if (!data?.byType && typeof data?.count === "number") activity = data.count;
    // Unread *messages* (not message notifications) drive the chat badge.
    const messages =
      typeof msgs?.data?.count === "number" ? msgs.data.count : byType.message ?? 0;
    emit({ activity, messages });
  } catch {
    /* keep the last known counts */
  } finally {
    inflight = false;
  }
}

/** Optimistically zero a counter (e.g. when the user opens that page). */
export function clearUnread(kind: keyof UnreadCounts) {
  emit({ ...state, [kind]: 0 });
}

function onVisible() {
  if (document.visibilityState === "visible") void refreshUnreadCounts();
}

function start() {
  if (timer) return;
  void refreshUnreadCounts();
  timer = setInterval(() => {
    if (document.visibilityState === "visible") void refreshUnreadCounts();
  }, POLL_MS);
  document.addEventListener("visibilitychange", onVisible);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisible);
}

export function useUnreadCounts(): UnreadCounts {
  const [counts, setCounts] = useState(state);
  useEffect(() => {
    listeners.add(setCounts);
    start();
    return () => {
      listeners.delete(setCounts);
      if (listeners.size === 0) stop();
    };
  }, []);
  return counts;
}

export function formatBadge(n: number) {
  return n > 99 ? "99+" : String(n);
}
