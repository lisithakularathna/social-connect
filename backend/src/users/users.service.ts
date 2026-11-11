import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { FollowsService } from '../follows/follows.service.js';
import {
  canViewContent,
  getBlockedIds,
  hasBlocked,
  isFollowing,
  presenceFor,
} from '../common/relations.js';

const MESSAGE_PRIVACY = ['everyone', 'followers', 'nobody'] as const;
const COMMENT_PRIVACY = ['everyone', 'followers', 'off'] as const;
const BOOLEAN_SETTINGS = [
  'isPrivate',
  'showActivityStatus',
  'hideLikeCounts',
  'notifyLikes',
  'notifyComments',
  'notifyFollows',
  'notifyMessages',
  'notifyMentions',
] as const;

type SettingsPatch = Partial<
  Record<(typeof BOOLEAN_SETTINGS)[number], boolean> & {
    messagePrivacy: string;
    commentPrivacy: string;
  }
>;

type UserRow = NonNullable<Awaited<ReturnType<UsersService['findById']>>>;

const publicCard = (u: {
  id: number;
  username: string | null;
  name: string | null;
  bio?: string | null;
  profileImageUrl: string | null;
  isPrivate?: boolean | null;
}) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  bio: u.bio ?? null,
  profileImageUrl: u.profileImageUrl,
  isPrivate: Boolean(u.isPrivate),
});

@Injectable()
export class UsersService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly followsService: FollowsService,
  ) {}

  async findById(id: number) {
    if (!Number.isFinite(id)) return null;
    return db.orm.public.User.where({ id }).first();
  }

  async getFollowStats(userId: number, currentUserId?: number) {
    const [followers, following] = await Promise.all([
      db.orm.public.Follow.where({ followingId: userId }).all(),
      db.orm.public.Follow.where({ followerId: userId }).all(),
    ]);

    const amFollowing = currentUserId
      ? followers.some((f) => f.followerId === currentUserId)
      : false;
    const isRequested =
      currentUserId && !amFollowing
        ? await this.followsService.isRequested(currentUserId, userId)
        : false;

    return {
      followersCount: followers.length,
      followingCount: following.length,
      isFollowing: amFollowing,
      isRequested,
    };
  }

  // ── Profile ───────────────────────────────────────────────

  /** The signed-in user, with stats and settings. */
  async getMe(userId: number) {
    const user = await this.findById(userId);
    if (!user) return null;
    const stats = await this.getFollowStats(userId);
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      bio: user.bio,
      profileImageUrl: user.profileImageUrl,
      isPrivate: Boolean(user.isPrivate),
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      createdAt: user.createdAt,
      followersCount: stats.followersCount,
      followingCount: stats.followingCount,
    };
  }

  /** Another user's profile, as seen by `viewerId`. */
  async getProfile(targetId: number, viewerId: number) {
    const user = await this.findById(targetId);
    // Someone who blocked you looks like they don't exist.
    if (!user || (await hasBlocked(targetId, viewerId))) {
      throw new NotFoundException('User not found');
    }

    const [stats, viewer, youBlocked, followsYou, postsCount] = await Promise.all([
      this.getFollowStats(targetId, viewerId),
      this.findById(viewerId),
      hasBlocked(viewerId, targetId),
      isFollowing(targetId, viewerId),
      db.orm.public.Post.where({ authorId: targetId }).select('id').all().then((r) => r.length),
    ]);
    const canView = !youBlocked && (await canViewContent(viewerId, user));
    const muted = viewerId
      ? Boolean(
          await db.orm.public.Mute.where({ muterId: viewerId, mutedId: targetId }).first(),
        )
      : false;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt,
      isPrivate: Boolean(user.isPrivate),
      postsCount,
      followersCount: stats.followersCount,
      followingCount: stats.followingCount,
      isFollowing: stats.isFollowing,
      isRequested: stats.isRequested,
      followsYou,
      isBlocked: youBlocked,
      isMuted: muted,
      canViewContent: canView,
      canMessage: !youBlocked && (await this.canMessage(viewerId, user)),
      ...presenceFor(user, viewer),
    };
  }

  /** Resolve an @username (case-insensitive) to a profile. */
  async getProfileByUsername(username: string, viewerId: number) {
    const clean = String(username ?? '').trim().replace(/^@/, '').toLowerCase();
    if (!clean) throw new NotFoundException('User not found');
    const candidates = await db.orm.public.User.select('id', 'username').all();
    const match = candidates.find((u) => u.username?.toLowerCase() === clean);
    if (!match) throw new NotFoundException('User not found');
    return this.getProfile(match.id, viewerId);
  }

  /** Mirrors MessagesService.canMessage for profile display. */
  private async canMessage(senderId: number, target: UserRow) {
    if (senderId === target.id) return true;
    if (target.messagePrivacy === 'nobody') return false;
    if (target.messagePrivacy === 'followers') {
      return isFollowing(senderId, target.id);
    }
    return true;
  }

  // Older mobile builds read lists from /users/:id/followers|following.
  getFollowersList(userId: number, viewerId: number) {
    return this.followsService.getFollowers(userId, viewerId);
  }

  getFollowingList(userId: number, viewerId: number) {
    return this.followsService.getFollowing(userId, viewerId);
  }

  // Kept for the mobile app, which toggles via POST /users/:id/follow.
  async toggleFollow(currentUserId: number, targetUserId: number) {
    const [following, requested] = await Promise.all([
      this.followsService.isFollowing(currentUserId, targetUserId),
      this.followsService.isRequested(currentUserId, targetUserId),
    ]);

    const result =
      following || requested
        ? await this.followsService.unfollowUser(currentUserId, targetUserId)
        : await this.followsService.followUser(currentUserId, targetUserId);

    const stats = await this.getFollowStats(targetUserId, currentUserId);
    return { ...result, ...stats };
  }

  async updateProfile(
    id: number,
    name?: string,
    username?: string,
    bio?: string,
    file?: { buffer: Buffer },
  ) {
    if (name !== undefined) {
      name = String(name).trim().slice(0, 60);
    }
    if (bio !== undefined) {
      bio = String(bio).trim();
      if (bio.length > 300) {
        throw new BadRequestException('Bio must be 300 characters or fewer');
      }
    }
    if (username !== undefined) {
      username = String(username).trim();
      if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
        throw new BadRequestException(
          'Username must be 3-30 characters: letters, numbers, "_" or "."',
        );
      }
      const conflict = (
        await db.orm.public.User.where({ username }).all()
      ).find((u) => u.id !== id);
      if (conflict) {
        throw new ConflictException('Username is already taken');
      }
    }

    let profileImageUrl: string | undefined;
    if (file) {
      profileImageUrl = await this.cloudinaryService.uploadImage(
        file.buffer,
        'social-connect/profiles',
      );
    }

    const updateData: {
      name?: string;
      username?: string;
      bio?: string;
      profileImageUrl?: string;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (profileImageUrl) updateData.profileImageUrl = profileImageUrl;

    const user = await db.orm.public.User.where({ id }).update(updateData);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
      },
    };
  }

  /** Remove the profile photo. */
  async removeAvatar(id: number) {
    await db.orm.public.User.where({ id }).update({ profileImageUrl: null });
    return { message: 'Profile photo removed' };
  }

  // ── Settings ──────────────────────────────────────────────

  async getSettings(userId: number) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      email: user.email,
      createdAt: user.createdAt,
      isPrivate: Boolean(user.isPrivate),
      messagePrivacy: user.messagePrivacy ?? 'everyone',
      commentPrivacy: user.commentPrivacy ?? 'everyone',
      showActivityStatus: user.showActivityStatus !== false,
      hideLikeCounts: Boolean(user.hideLikeCounts),
      notifyLikes: user.notifyLikes !== false,
      notifyComments: user.notifyComments !== false,
      notifyFollows: user.notifyFollows !== false,
      notifyMessages: user.notifyMessages !== false,
      notifyMentions: user.notifyMentions !== false,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
    };
  }

  async updateSettings(userId: number, body: SettingsPatch) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const patch: Record<string, unknown> = {};
    for (const key of BOOLEAN_SETTINGS) {
      if (body?.[key] !== undefined) {
        if (typeof body[key] !== 'boolean') {
          throw new BadRequestException(`${key} must be true or false`);
        }
        patch[key] = body[key];
      }
    }
    if (body?.messagePrivacy !== undefined) {
      if (!MESSAGE_PRIVACY.includes(body.messagePrivacy as never)) {
        throw new BadRequestException(
          'messagePrivacy must be everyone, followers or nobody',
        );
      }
      patch.messagePrivacy = body.messagePrivacy;
    }
    if (body?.commentPrivacy !== undefined) {
      if (!COMMENT_PRIVACY.includes(body.commentPrivacy as never)) {
        throw new BadRequestException(
          'commentPrivacy must be everyone, followers or off',
        );
      }
      patch.commentPrivacy = body.commentPrivacy;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    await db.orm.public.User.where({ id: userId }).update(patch);

    // Going public lets everyone who asked in.
    let approvedRequests = 0;
    if (user.isPrivate && patch.isPrivate === false) {
      approvedRequests = await this.followsService.approveAllRequests(userId);
    }

    return { ...(await this.getSettings(userId)), approvedRequests };
  }

  // ── Blocking & muting ─────────────────────────────────────

  async blockUser(userId: number, targetId: number) {
    if (userId === targetId) {
      throw new BadRequestException("You can't block yourself");
    }
    const target = await this.findById(targetId);
    if (!target) throw new NotFoundException('User not found');

    const existing = await db.orm.public.Block
      .where({ blockerId: userId, blockedId: targetId })
      .first();
    if (!existing) {
      await db.orm.public.Block.create({ blockerId: userId, blockedId: targetId });
    }

    // Blocking cuts every connection in both directions.
    await Promise.all([
      db.orm.public.Follow.where({ followerId: userId, followingId: targetId }).deleteAll(),
      db.orm.public.Follow.where({ followerId: targetId, followingId: userId }).deleteAll(),
      db.orm.public.FollowRequest.where({ requesterId: userId, targetId }).deleteAll(),
      db.orm.public.FollowRequest.where({ requesterId: targetId, targetId: userId }).deleteAll(),
    ]);

    return { message: `Blocked @${target.username ?? 'user'}`, isBlocked: true };
  }

  async unblockUser(userId: number, targetId: number) {
    await db.orm.public.Block
      .where({ blockerId: userId, blockedId: targetId })
      .deleteAll();
    return { message: 'Unblocked', isBlocked: false };
  }

  async getBlockedUsers(userId: number) {
    const rows = await db.orm.public.Block
      .include('blocked')
      .where({ blockerId: userId })
      .orderBy((b) => b.createdAt.desc())
      .all();
    return rows.map((r) => ({ ...publicCard(r.blocked), blockedAt: r.createdAt }));
  }

  async muteUser(userId: number, targetId: number) {
    if (userId === targetId) {
      throw new BadRequestException("You can't mute yourself");
    }
    const target = await this.findById(targetId);
    if (!target) throw new NotFoundException('User not found');
    const existing = await db.orm.public.Mute
      .where({ muterId: userId, mutedId: targetId })
      .first();
    if (!existing) {
      await db.orm.public.Mute.create({ muterId: userId, mutedId: targetId });
    }
    return { message: `Muted @${target.username ?? 'user'}`, isMuted: true };
  }

  async unmuteUser(userId: number, targetId: number) {
    await db.orm.public.Mute
      .where({ muterId: userId, mutedId: targetId })
      .deleteAll();
    return { message: 'Unmuted', isMuted: false };
  }

  async getMutedUsers(userId: number) {
    const rows = await db.orm.public.Mute
      .include('muted')
      .where({ muterId: userId })
      .orderBy((m) => m.createdAt.desc())
      .all();
    return rows.map((r) => ({ ...publicCard(r.muted), mutedAt: r.createdAt }));
  }

  /** One-time import of block/mute lists kept on a device before sync existed. */
  async importRelations(
    userId: number,
    body: { blocked?: unknown[]; muted?: unknown[] },
  ) {
    const ids = (list: unknown[] | undefined) =>
      (Array.isArray(list) ? list : [])
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0 && v !== userId)
        .slice(0, 500);

    let blocked = 0;
    let muted = 0;
    for (const id of ids(body?.blocked)) {
      if (await this.findById(id)) {
        await this.blockUser(userId, id);
        blocked++;
      }
    }
    for (const id of ids(body?.muted)) {
      if (await this.findById(id)) {
        await this.muteUser(userId, id);
        muted++;
      }
    }
    return { blocked, muted };
  }

  // ── Data export ───────────────────────────────────────────

  async exportData(userId: number) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const [posts, comments, likes, following, followers, saved, sent, received] =
      await Promise.all([
        db.orm.public.Post.where({ authorId: userId }).orderBy((p) => p.createdAt.desc()).all(),
        db.orm.public.Comment.where({ userId }).orderBy((c) => c.createdAt.desc()).all(),
        db.orm.public.PostLike.where({ userId }).all(),
        db.orm.public.Follow.include('following').where({ followerId: userId }).all(),
        db.orm.public.Follow.include('follower').where({ followingId: userId }).all(),
        db.orm.public.SavedPost.where({ userId }).all(),
        db.orm.public.Message.where({ senderId: userId }).select('id').all(),
        db.orm.public.Message.where({ receiverId: userId }).select('id').all(),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        createdAt: user.createdAt,
      },
      settings: await this.getSettings(userId),
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        imageUrl: p.imageUrl,
        createdAt: p.createdAt,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        content: c.content,
        createdAt: c.createdAt,
      })),
      likedPostIds: likes.map((l) => l.postId),
      savedPostIds: saved.map((s) => s.postId),
      following: following.map((f) => f.following.username),
      followers: followers.map((f) => f.follower.username),
      // Message bodies are end-to-end encrypted, so only counts are exported.
      messages: { sent: sent.length, received: received.length },
    };
  }

  async deleteAccount(id: number) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    // The older relations aren't ON DELETE CASCADE in the database, so remove
    // everything that references this user first (children before parents).
    const myPosts = await db.orm.public.Post
      .where({ authorId: id })
      .select('id')
      .all();
    const myPostIds = myPosts.map((p) => p.id);

    if (myPostIds.length > 0) {
      await db.orm.public.PostLike
        .where((l) => l.postId.in(myPostIds))
        .deleteAll();
      await db.orm.public.Comment
        .where((c) => c.postId.in(myPostIds))
        .deleteAll();
    }

    await Promise.all([
      db.orm.public.PostLike.where({ userId: id }).deleteAll(),
      db.orm.public.Comment.where({ userId: id }).deleteAll(),
      db.orm.public.Notification.where({ userId: id }).deleteAll(),
      db.orm.public.Notification.where({ actorId: id }).deleteAll(),
      db.orm.public.Message.where({ senderId: id }).deleteAll(),
      db.orm.public.Message.where({ receiverId: id }).deleteAll(),
      db.orm.public.Follow.where({ followerId: id }).deleteAll(),
      db.orm.public.Follow.where({ followingId: id }).deleteAll(),
    ]);

    // Block / Mute / SavedPost / FollowRequest cascade in the database.
    await db.orm.public.Post.where({ authorId: id }).deleteAll();
    await db.orm.public.User.where({ id }).delete();

    return { message: 'Account deleted successfully' };
  }

  // ── Discovery ─────────────────────────────────────────────

  /**
   * People the user doesn't follow yet, ranked by "follows you", mutual
   * connections and then follower count.
   */
  async getSuggestions(currentUserId: number, limit = 8) {
    const [allUsers, allFollows, blocked, requests] = await Promise.all([
      db.orm.public.User.all(),
      db.orm.public.Follow.all(),
      getBlockedIds(currentUserId),
      db.orm.public.FollowRequest.where({ requesterId: currentUserId }).all(),
    ]);
    const requested = new Set(requests.map((r) => r.targetId));

    const myFollowing = new Set(
      allFollows
        .filter((f) => f.followerId === currentUserId)
        .map((f) => f.followingId),
    );

    const followerCount = new Map<number, number>();
    const mutuals = new Map<number, number>();
    for (const f of allFollows) {
      followerCount.set(f.followingId, (followerCount.get(f.followingId) ?? 0) + 1);
      // Followed by someone I follow → a mutual connection.
      if (myFollowing.has(f.followerId)) {
        mutuals.set(f.followingId, (mutuals.get(f.followingId) ?? 0) + 1);
      }
    }
    const followsMe = new Set(
      allFollows
        .filter((f) => f.followingId === currentUserId)
        .map((f) => f.followerId),
    );

    return allUsers
      .filter(
        (u) =>
          u.id !== currentUserId &&
          !myFollowing.has(u.id) &&
          !blocked.has(u.id) &&
          !requested.has(u.id),
      )
      .map((u) => ({
        ...publicCard(u),
        followersCount: followerCount.get(u.id) ?? 0,
        mutualCount: mutuals.get(u.id) ?? 0,
        followsYou: followsMe.has(u.id),
      }))
      .sort(
        (a, b) =>
          Number(b.followsYou) - Number(a.followsYou) ||
          b.mutualCount - a.mutualCount ||
          b.followersCount - a.followersCount ||
          b.id - a.id,
      )
      .slice(0, Math.min(Math.max(limit, 1), 30));
  }

  async searchUsers(query: string, currentUserId: number) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const term = query.trim().replace(/^@/, '').toLowerCase();
    if (!term) return [];

    const [allUsers, blocked] = await Promise.all([
      db.orm.public.User.all(),
      getBlockedIds(currentUserId),
    ]);

    // Rank exact and prefix matches above "contains" matches.
    const score = (value: string | null | undefined) => {
      const v = value?.toLowerCase() ?? '';
      if (!v) return 0;
      if (v === term) return 3;
      if (v.startsWith(term)) return 2;
      if (v.includes(term)) return 1;
      return 0;
    };

    return allUsers
      .filter((u) => u.id !== currentUserId && !blocked.has(u.id))
      .map((u) => ({ u, rank: Math.max(score(u.username), score(u.name)) }))
      .filter(({ rank }) => rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 30)
      .map(({ u }) => publicCard(u));
  }

  /** Guard used by other services. */
  async assertNotBlocked(a: number, b: number) {
    const blocked = await getBlockedIds(a);
    if (blocked.has(b)) throw new ForbiddenException('Not available');
  }
}
