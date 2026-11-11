import api from "../api/api";

export interface CurrentUser {
  id: number;
  email?: string;
  username?: string;
  name?: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount?: number;
  followingCount?: number;
}

let cached: CurrentUser | null = null;
let inflight: Promise<CurrentUser | null> | null = null;
const listeners = new Set<(user: CurrentUser | null) => void>();

/** Reads the user id straight from the JWT, without a network call. */
export function getUserIdFromToken(): number | null {
  const token = localStorage.getItem("accessToken");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const id = Number(payload.sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Returns the signed-in user. Every component on a page shares one request,
 * instead of each PostCard/Navbar fetching /users/me on its own.
 */
export function getCurrentUser(force = false): Promise<CurrentUser | null> {
  if (!force && cached) return Promise.resolve(cached);
  if (!force && inflight) return inflight;

  inflight = api
    .get("/users/me")
    .then((res) => {
      cached = res.data ?? null;
      listeners.forEach((l) => l(cached));
      if (cached) void migrateLocalData(cached.id);
      return cached;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Call after the profile changes so every subscriber re-renders. */
export function refreshCurrentUser() {
  return getCurrentUser(true);
}

export function subscribeCurrentUser(listener: (user: CurrentUser | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearSession() {
  cached = null;
  inflight = null;
  localStorage.removeItem("accessToken");
  listeners.forEach((l) => l(null));
}

export function setSessionToken(token: string) {
  cached = null;
  localStorage.setItem("accessToken", token);
}

let migrationStarted = false;

/**
 * Older versions kept saved posts and block/mute lists only in this browser.
 * Upload them once so they sync across devices, then drop the local copies.
 */
async function migrateLocalData(userId: number) {
  if (migrationStarted) return;
  migrationStarted = true;
  const flag = `sc_sync_migrated_v1:${userId}`;
  try {
    if (localStorage.getItem(flag)) return;

    const readIds = (key: string): number[] => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        return (Array.isArray(parsed) ? parsed : [])
          .map((item: unknown) =>
            item && typeof item === "object" ? Number((item as { id?: unknown }).id) : Number(item)
          )
          .filter((n: number) => Number.isInteger(n) && n > 0);
      } catch {
        return [];
      }
    };

    const saved = readIds("savedPosts");
    const blocked = readIds("blockedUsers");
    const muted = readIds("mutedUsers");

    if (saved.length) await api.post("/posts/saved/import", { postIds: saved });
    if (blocked.length || muted.length) {
      await api.post("/users/me/relations/import", { blocked, muted });
    }

    localStorage.removeItem("savedPosts");
    localStorage.removeItem("blockedUsers");
    localStorage.removeItem("mutedUsers");
    localStorage.setItem(flag, "1");
  } catch {
    // Try again next session.
    migrationStarted = false;
  }
}
