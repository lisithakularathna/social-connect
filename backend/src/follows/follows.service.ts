import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';

@Injectable()
export class FollowsService {
  async followUser(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Check if user exists
    const userExists = await db.orm.public.User
      .where({ id: followingId })
      .all().then(res => res.length);

    if (Number(userExists) === 0) {
      throw new NotFoundException('User not found');
    }

    // Check if already following
    const existingFollow = await db.orm.public.Follow
      .where({ followerId, followingId })
      .all().then(res => res.length);

    if (Number(existingFollow) > 0) {
      throw new BadRequestException('Already following this user');
    }

    await db.orm.public.Follow.create({
      followerId,
      followingId,
    });

    return {
      message: 'Successfully followed user',
    };
  }

  async unfollowUser(followerId: number, followingId: number) {
    const existingFollow = await db.orm.public.Follow
      .where({ followerId, followingId })
      .all().then(res => res.length);

    if (Number(existingFollow) === 0) {
      throw new NotFoundException('Not following this user');
    }

    await db.orm.public.Follow
      .where({ followerId, followingId })
      .delete();

    return {
      message: 'Successfully unfollowed user',
    };
  }

  async getFollowers(userId: number) {
    const followers = await db.orm.public.Follow
      .include('follower')
      .where({ followingId: userId })
      .all();

    return followers.map((follow) => ({
      id: follow.follower.id,
      username: follow.follower.username,
      name: follow.follower.name,
      profileImageUrl: follow.follower.profileImageUrl,
      followedAt: follow.createdAt,
    }));
  }

  async getFollowing(userId: number) {
    const following = await db.orm.public.Follow
      .include('following')
      .where({ followerId: userId })
      .all();

    return following.map((follow) => ({
      id: follow.following.id,
      username: follow.following.username,
      name: follow.following.name,
      profileImageUrl: follow.following.profileImageUrl,
      followedAt: follow.createdAt,
    }));
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const count = await db.orm.public.Follow
      .where({ followerId, followingId })
      .all().then(res => res.length);

    return Number(count) > 0;
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
