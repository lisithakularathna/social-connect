import { db } from '../prisma/db.js';

/**
 * Shared relationship / visibility helpers used by several modules.
 * Kept as plain functions (no DI) because they only need the db client.
 */

export type PrivacyUser = {
  id: number;
  isPrivate?: boolean | null;
};

/** Ids that `userId` blocked, plus ids that blocked `userId`. */
export async function getBlockedIds(userId: number): Promise<Set<number>> {
  if (!userId) return new Set();
  const [mine, theirs] = await Promise.all([
    db.orm.public.Block.where({ blockerId: userId }).all(),
    db.orm.public.Block.where({ blockedId: userId }).all(),
  ]);
  return new Set([
    ...mine.map((b) => b.blockedId),
    ...theirs.map((b) => b.blockerId),
  ]);
}

/** True when either user has blocked the other. */
export async function isBlockedEitherWay(a: number, b: number) {
  if (!a || !b || a === b) return false;
  const [ab, ba] = await Promise.all([
    db.orm.public.Block.where({ blockerId: a, blockedId: b }).first(),
    db.orm.public.Block.where({ blockerId: b, blockedId: a }).first(),
  ]);
  return Boolean(ab || ba);
}

/** True when `blockerId` has blocked `blockedId` (one direction). */
export async function hasBlocked(blockerId: number, blockedId: number) {
  if (!blockerId || !blockedId) return false;
  return Boolean(
    await db.orm.public.Block.where({ blockerId, blockedId }).first(),
  );
}

export async function getMutedIds(userId: number): Promise<Set<number>> {
  if (!userId) return new Set();
  const rows = await db.orm.public.Mute.where({ muterId: userId }).all();
  return new Set(rows.map((m) => m.mutedId));
}

export async function getFollowingIds(userId: number): Promise<Set<number>> {
  if (!userId) return new Set();
  const rows = await db.orm.public.Follow.where({ followerId: userId }).all();
  return new Set(rows.map((f) => f.followingId));
}

export async function isFollowing(followerId: number, followingId: number) {
  if (!followerId || !followingId) return false;
  return Boolean(
    await db.orm.public.Follow.where({ followerId, followingId }).first(),
  );
}

/** Private accounts whose content the viewer may NOT see. */
export async function getHiddenPrivateIds(viewerId: number) {
  const [privateUsers, following] = await Promise.all([
    db.orm.public.User.where({ isPrivate: true }).select('id').all(),
    getFollowingIds(viewerId),
  ]);
  return new Set(
    privateUsers
      .map((u) => u.id)
      .filter((id) => id !== viewerId && !following.has(id)),
  );
}

/**
 * Whether `viewerId` may see the posts / lists of `owner`.
 * Blocks are checked separately by callers that need to distinguish them.
 */
export async function canViewContent(viewerId: number, owner: PrivacyUser) {
  if (!owner) return false;
  if (owner.id === viewerId) return true;
  if (!owner.isPrivate) return true;
  return isFollowing(viewerId, owner.id);
}

const MENTION_RE = /(^|[^a-zA-Z0-9_.])@([a-zA-Z0-9_.]{3,30})/g;

/** Unique @usernames mentioned in a piece of text. */
export function extractMentions(...texts: Array<string | null | undefined>) {
  const names = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(MENTION_RE)) {
      names.add(match[2].replace(/\.+$/, ''));
    }
  }
  return [...names].filter((n) => n.length >= 3);
}

/** Users matching the mentioned usernames (exact, then case-insensitive). */
export async function resolveMentionedUsers(names: string[]) {
  if (names.length === 0) return [];
  const lower = new Set(names.map((n) => n.toLowerCase()));
  const candidates = await db.orm.public.User.select('id', 'username')
    .all();
  return candidates.filter(
    (u) => u.username && lower.has(u.username.toLowerCase()),
  );
}

/** "Active now" window used for presence. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function presenceFor(
  target: { showActivityStatus?: boolean | null; lastActiveAt?: string | null },
  viewer?: { showActivityStatus?: boolean | null } | null,
) {
  // Reciprocal, like most apps: if you hide your status you can't see others'.
  if (!target?.showActivityStatus || viewer?.showActivityStatus === false) {
    return { lastActiveAt: null, isOnline: false };
  }
  const last = target.lastActiveAt ? new Date(target.lastActiveAt) : null;
  return {
    lastActiveAt: last ? last.toISOString() : null,
    isOnline: Boolean(last && Date.now() - last.getTime() < ONLINE_WINDOW_MS),
  };
}
