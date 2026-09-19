import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findById(id: number) {
    const users = await db.orm.public.User
      .where({ id })
      .all();

    return users[0] ?? null;
  }

  async getFollowStats(userId: number, currentUserId?: number) {
    const followers = await db.orm.public.Follow
      .where({ followingId: userId })
      .all();

    const following = await db.orm.public.Follow
      .where({ followerId: userId })
      .all();

    const isFollowing = currentUserId
      ? followers.some((f) => f.followerId === currentUserId)
      : false;

    return {
      followersCount: followers.length,
      followingCount: following.length,
      isFollowing,
    };
  }

  async toggleFollow(currentUserId: number, targetUserId: number) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const targetUser = await this.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existing = await db.orm.public.Follow
      .where({
        followerId: currentUserId,
        followingId: targetUserId,
      })
      .all();

    if (existing.length > 0) {
      await db.orm.public.Follow
        .where({ id: existing[0].id })
        .delete();

      const stats = await this.getFollowStats(targetUserId, currentUserId);
      return {
        message: 'Unfollowed successfully',
        ...stats,
      };
    } else {
      await db.orm.public.Follow.create({
        followerId: currentUserId,
        followingId: targetUserId,
      });

      const currentUser = await this.findById(currentUserId);
      const followerName =
        currentUser?.name || currentUser?.username || 'Someone';

      await this.notificationsService.createNotification(
        targetUserId,
        'follow',
        `${followerName} started following you`,
      );

      const stats = await this.getFollowStats(targetUserId, currentUserId);
      return {
        message: 'Followed successfully',
        ...stats,
      };
    }
  }

  async getFollowers(userId: number) {
    const follows = await db.orm.public.Follow
      .where({ followingId: userId })
      .all();

    const followerIds = follows.map((f) => f.followerId);
    if (followerIds.length === 0) return [];

    const allUsers = await db.orm.public.User.all();
    return allUsers
      .filter((u) => followerIds.includes(u.id))
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        bio: u.bio,
        profileImageUrl: u.profileImageUrl,
      }));
  }

  async getFollowing(userId: number) {
    const follows = await db.orm.public.Follow
      .where({ followerId: userId })
      .all();

    const followingIds = follows.map((f) => f.followingId);
    if (followingIds.length === 0) return [];

    const allUsers = await db.orm.public.User.all();
    return allUsers
      .filter((u) => followingIds.includes(u.id))
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        bio: u.bio,
        profileImageUrl: u.profileImageUrl,
      }));
  }

 async updateProfile(
  id: number,
  name?: string,
  username?: string,
  bio?: string,
  file?: { buffer: Buffer },
) {
  // username duplicate check
  if (username !== undefined) {
    const existing = await db.orm.public.User
      .where({ username })
      .all();

    const conflict = existing.find(
      (u) => u.id !== id,
    );

    if (conflict) {
      throw new ConflictException(
        'Username is already taken',
      );
    }
  }

  let profileImageUrl: string | undefined;

  if (file) {
    profileImageUrl =
      await this.cloudinaryService.uploadImage(
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

  if (name !== undefined) {
    updateData.name = name;
  }

  if (username !== undefined) {
    updateData.username = username;
  }

  if (bio !== undefined) {
    updateData.bio = bio;
  }

  if (profileImageUrl) {
    updateData.profileImageUrl = profileImageUrl;
  }

  const user = await db.orm.public.User
    .where({ id })
    .update(updateData);

  if (!user) {
    throw new Error('User not found');
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

  async deleteAccount(id: number) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await db.orm.public.User.where({ id }).delete();
    return { message: 'Account deleted successfully' };
  }

  async searchUsers(
    query: string,
    currentUserId: number,
  ) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const term = query.trim().toLowerCase();

    const allUsers = await db.orm.public.User
      .all();

    return allUsers
      .filter((u) => {
        if (u.id === currentUserId) return false;
        const matchUsername = u.username
          ?.toLowerCase()
          .includes(term);
        const matchName = u.name
          ?.toLowerCase()
          .includes(term);
        return matchUsername || matchName;
      })
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        bio: u.bio,
        profileImageUrl: u.profileImageUrl,
      }));
  }
}