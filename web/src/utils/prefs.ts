/**
 * Device preferences (theme, accent, motion, hidden words) plus thin wrappers
 * around the server-side block / mute endpoints.
 */
import api from "../api/api";

export const PREFS_CHANGED_EVENT = "sc:prefs_changed";

function emitPrefsChanged() {
  window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT));
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

// ── Theme ──────────────────────────────────────────────────

export type ThemeMode = "light" | "dark" | "system";

export const ACCENTS = [
  { name: "Rose", value: "#d94d6a" },
  { name: "Violet", value: "#7c5cff" },
  { name: "Ocean", value: "#2f80ed" },
  { name: "Emerald", value: "#12a37f" },
  { name: "Amber", value: "#e08a1e" },
  { name: "Graphite", value: "#4b5563" },
] as const;

export function getThemeMode(): ThemeMode {
  const mode = read("themeMode");
  if (mode === "light" || mode === "dark" || mode === "system") return mode;
  return read("darkMode") === "true" ? "dark" : "light";
}

export function isDarkActive(mode = getThemeMode()) {
  if (mode === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }
  return mode === "dark";
}

export function getAccent(): string {
  return read("accentColor") || ACCENTS[0].value;
}

export function getReduceMotion(): boolean {
  return read("reduceMotion") === "true";
}

let systemListenerAttached = false;

/** Apply theme, accent and motion preferences (call before first render). */
export function applySavedTheme() {
  const dark = isDarkActive();
  document.body.classList.toggle("dark-mode", dark);
  document.body.classList.toggle("reduce-motion", getReduceMotion());
  document.documentElement.style.setProperty("--accent", getAccent());

  if (!systemListenerAttached && window.matchMedia) {
    systemListenerAttached = true;
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener?.("change", () => {
        if (getThemeMode() === "system") {
          applySavedTheme();
          emitPrefsChanged();
        }
      });
  }
}

export function setThemeMode(mode: ThemeMode) {
  write("themeMode", mode);
  // Legacy key still read by older code paths.
  write("darkMode", String(isDarkActive(mode)));
  applySavedTheme();
  emitPrefsChanged();
}

export function setAccent(value: string) {
  write("accentColor", value);
  applySavedTheme();
  emitPrefsChanged();
}

export function setReduceMotion(value: boolean) {
  write("reduceMotion", String(value));
  applySavedTheme();
  emitPrefsChanged();
}

// ── Hidden words (client-side content filter) ─────────────

export function getHiddenWords(): string[] {
  try {
    const parsed = JSON.parse(read("hiddenWords") || "[]");
    return Array.isArray(parsed) ? parsed.filter((w) => typeof w === "string") : [];
  } catch {
    return [];
  }
}

export function setHiddenWords(words: string[]) {
  const clean = [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))].slice(0, 100);
  write("hiddenWords", JSON.stringify(clean));
  emitPrefsChanged();
  return clean;
}

/** True when the text contains one of the user's hidden words. */
export function containsHiddenWord(text: string | null | undefined, words = getHiddenWords()) {
  if (!text || words.length === 0) return false;
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}

// ── Block / mute (server-side, synced across devices) ─────

export interface ListedUser {
  id: number;
  username?: string | null;
  name?: string | null;
  profileImageUrl?: string | null;
}

export async function blockUser(userId: number) {
  const { data } = await api.post(`/users/${userId}/block`);
  emitPrefsChanged();
  return data;
}

export async function unblockUser(userId: number) {
  const { data } = await api.delete(`/users/${userId}/block`);
  emitPrefsChanged();
  return data;
}

export async function muteUser(userId: number) {
  const { data } = await api.post(`/users/${userId}/mute`);
  emitPrefsChanged();
  return data;
}

export async function unmuteUser(userId: number) {
  const { data } = await api.delete(`/users/${userId}/mute`);
  emitPrefsChanged();
  return data;
}

export async function fetchBlockedUsers(): Promise<ListedUser[]> {
  const { data } = await api.get("/users/me/blocked");
  return Array.isArray(data) ? data : [];
}

export async function fetchMutedUsers(): Promise<ListedUser[]> {
  const { data } = await api.get("/users/me/muted");
  return Array.isArray(data) ? data : [];
}
