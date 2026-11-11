import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  canViewContent,
  getBlockedIds,
  getFollowingIds,
  isBlockedEitherWay,
} from '../common/relations.js';

@Injectable()
export class FollowsService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  private async displayName(userId: number) {
    const user = await db.orm.public.User.where({ id: userId }).first();
    return user?.name || user?.username || 'Someone';
  }

  /**
   * Follow a user. Private accounts get a follow request instead, which the
   * owner approves or declines.
   */
  async followUser(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const target = await db.orm.public.User
      .where({ id: followingId })
      .first();

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (await isBlockedEitherWay(followerId, followingId)) {
      throw new ForbiddenException("You can't follow this account");
    }

    const existingFollow = await db.orm.public.Follow
      .where({ followerId, followingId })
      .first();

    if (existingFollow) {
      throw new BadRequestException('Already following this user');
    }

    const followerName = await this.displayName(followerId);

    if (target.isPrivate) {
      const pending = await db.orm.public.FollowRequest
        .where({ requesterId: followerId, targetId: followingId })
        .first();
      if (!pending) {
        await db.orm.public.FollowRequest.create({
          requesterId: followerId,
          targetId: followingId,
        });
        await this.notificationsService.createNotification(
          followingId,
          'follow_request',
          `${followerName} requested to follow you`,
          { actorId: followerId },
        );
      }
      return {
        message: 'Follow request sent',
        requested: true,
        isFollowing: false,
      };
    }

    await db.orm.public.Follow.create({
      followerId,
      followingId,
    });

    await this.notificationsService.createNotification(
      followingId,
      'follow',
      `${followerName} started following you`,
      { actorId: followerId },
    );

    return {
      message: 'Successfully followed user',
      requested: false,
      isFollowing: true,
    };
  }

  /** Unfollow, or cancel a pending follow request. */
  async unfollowUser(followerId: number, followingId: number) {
    const existingFollow = await db.orm.public.Follow
      .where({ followerId, followingId })
      .first();

    if (existingFollow) {
      await db.orm.public.Follow
        .where({ followerId, followingId })
        .delete();
      return { message: 'Successfully unfollowed user', isFollowing: false, requested: false };
    }

    const pending = await db.orm.public.FollowRequest
      .where({ requesterId: followerId, targetId: followingId })
      .first();
    if (pending) {
      await this.cancelRequest(followerId, followingId);
      return { message: 'Follow request cancelled', isFollowing: false, requested: false };
    }

    throw new NotFoundException('Not following this user');
  }

  /** Remove someone from your followers. */
  async removeFollower(userId: number, followerId: number) {
    await db.orm.public.Follow
      .where({ followerId, followingId: userId })
      .deleteAll();
    return { message: 'Follower removed' };
  }

  // ── Follow requests ───────────────────────────────────────

  async getIncomingRequests(userId: number) {
    const requests = await db.orm.public.FollowRequest
      .include('requester')
      .where({ targetId: userId })
      .orderBy((r) => r.createdAt.desc())
      .all();

    return requests.map((r) => ({
      id: r.id,
      requestedAt: r.createdAt,
      user: {
        id: r.requester.id,
        username: r.requester.username,
        name: r.requester.name,
        profileImageUrl: r.requester.profileImageUrl,
      },
    }));
  }

  async approveRequest(userId: number, requesterId: number) {
    const request = await db.orm.public.FollowRequest
      .where({ requesterId, targetId: userId })
      .first();
    if (!request) {
      throw new NotFoundException('Follow request not found');
    }

    await db.orm.public.FollowRequest
      .where({ requesterId, targetId: userId })
      .deleteAll();

    const already = await db.orm.public.Follow
      .where({ followerId: requesterId, followingId: userId })
      .first();
    if (!already) {
      await db.orm.public.Follow.create({
        followerId: requesterId,
        followingId: userId,
      });
    }

    await this.notificationsService.removeFollowRequestNotifications(
      userId,
      requesterId,
    );

    const ownerName = await this.displayName(userId);
    await this.notificationsService.createNotification(
      requesterId,
      'follow_accept',
      `${ownerName} accepted your follow request`,
      { actorId: userId },
    );

    return { message: 'Follow request approved' };
  }

  async declineRequest(userId: number, requesterId: number) {
    await db.orm.public.FollowRequest
      .where({ requesterId, targetId: userId })
      .deleteAll();
    await this.notificationsService.removeFollowRequestNotifications(
      userId,
      requesterId,
    );
    return { message: 'Follow request declined' };
  }

  async cancelRequest(requesterId: number, targetId: number) {
    await db.orm.public.FollowRequest
      .where({ requesterId, targetId })
      .deleteAll();
    await this.notificationsService.removeFollowRequestNotifications(
      targetId,
      requesterId,
    );
    return { message: 'Follow request cancelled' };
  }

  /** Called when an account switches from private to public. */
  async approveAllRequests(userId: number) {
    const pending = await db.orm.public.FollowRequest
      .where({ targetId: userId })
      .all();
    for (const request of pending) {
      await this.approveRequest(userId, request.requesterId);
    }
    return pending.length;
  }

  // ── Lists & stats ─────────────────────────────────────────

  /** Ids the viewer has a pending request to. */
  private async viewerRequestedIds(viewerId?: number) {
    if (!viewerId) return new Set<number>();
    const rows = await db.orm.public.FollowRequest
      .where({ requesterId: viewerId })
      .all();
    return new Set(rows.map((r) => r.targetId));
  }

  private async assertCanSeeLists(userId: number, viewerId?: number) {
    const owner = await db.orm.public.User.where({ id: userId }).first();
    if (!owner) throw new NotFoundException('User not found');
    if (viewerId && (await isBlockedEitherWay(viewerId, userId))) {
      throw new ForbiddenException('This list is not available');
    }
    if (!(await canViewContent(viewerId ?? 0, owner))) {
      throw new ForbiddenException('This account is private');
    }
  }

  async getFollowers(userId: number, viewerId?: number) {
    await this.assertCanSeeLists(userId, viewerId);

    const [followers, viewerFollows, requested, blocked] = await Promise.all([
      db.orm.public.Follow
        .include('follower')
        .where({ followingId: userId })
        .orderBy((f) => f.createdAt.desc())
        .all(),
      getFollowingIds(viewerId ?? 0),
      this.viewerRequestedIds(viewerId),
      getBlockedIds(viewerId ?? 0),
    ]);

    return followers
      .filter((f) => !blocked.has(f.follower.id))
      .map((follow) => ({
        id: follow.follower.id,
        username: follow.follower.username,
        name: follow.follower.name,
        bio: follow.follower.bio,
        profileImageUrl: follow.follower.profileImageUrl,
        isPrivate: follow.follower.isPrivate,
        followedAt: follow.createdAt,
        isFollowing: viewerFollows.has(follow.follower.id),
        isRequested: requested.has(follow.follower.id),
      }));
  }

  async getFollowing(userId: number, viewerId?: number) {
    await this.assertCanSeeLists(userId, viewerId);

    const [following, viewerFollows, requested, blocked] = await Promise.all([
      db.orm.public.Follow
        .include('following')
        .where({ followerId: userId })
        .orderBy((f) => f.createdAt.desc())
        .all(),
      getFollowingIds(viewerId ?? 0),
      this.viewerRequestedIds(viewerId),
      getBlockedIds(viewerId ?? 0),
    ]);

    return following
      .filter((f) => !blocked.has(f.following.id))
      .map((follow) => ({
        id: follow.following.id,
        username: follow.following.username,
        name: follow.following.name,
        bio: follow.following.bio,
        profileImageUrl: follow.following.profileImageUrl,
        isPrivate: follow.following.isPrivate,
        followedAt: follow.createdAt,
        isFollowing: viewerFollows.has(follow.following.id),
        isRequested: requested.has(follow.following.id),
      }));
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const row = await db.orm.public.Follow
      .where({ followerId, followingId })
      .first();
    return Boolean(row);
  }

  async isRequested(requesterId: number, targetId: number): Promise<boolean> {
    const row = await db.orm.public.FollowRequest
      .where({ requesterId, targetId })
      .first();
    return Boolean(row);
  }

  async getFollowStats(userId: number) {
    const [followersCount, followingCount] = await Promise.all([
      db.orm.public.Follow.where({ followingId: userId }).all().then(res => res.length),
      db.orm.public.Follow.where({ followerId: userId }).all().then(res => res.length),
    ]);

    return {
      followersCount: Number(followersCount),
      followingCount: Number(followingCount),
    };
  }
}
