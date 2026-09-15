import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { db } from '../prisma/db.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class LikesService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  async likePost(
    postId: number,
    userId: number,
  ) {
    const posts = await db.orm.public.Post
      .where({ id: postId })
      .all();

    if (posts.length === 0) {
      throw new NotFoundException('Post not found');
    }

    const post = posts[0];

    const existingLike = await db.orm.public.PostLike
      .where({
        postId,
        userId,
      })
      .all();

    if (existingLike.length > 0) {
      throw new ConflictException(
        'You already liked this post',
      );
    }

    const like = await db.orm.public.PostLike.create({
      postId,
      userId,
    });

    if (post.authorId !== userId) {
      const users = await db.orm.public.User
        .where({ id: userId })
        .all();
      const liker = users[0];
      const likerName =
        liker?.name || liker?.username || 'Someone';

      await this.notificationsService.createNotification(
        post.authorId,
        'like',
        `${likerName} liked your post "${post.title}"`,
      );
    }

    return {
      message: 'Post liked successfully',
      like,
    };
  }

  async getPostLikes(postId: number) {
    const likes = await db.orm.public.PostLike
      .where({ postId })
      .include('user')
      .all();

    return {
      postId,
      likeCount: likes.length,
      likes: likes.map((like) => ({
        id: like.id,
        userId: like.userId,
        username: like.user.username,
        name: like.user.name,
        createdAt: like.createdAt,
      })),
    };
  }

  async unlikePost(
    postId: number,
    userId: number,
  ) {
    const existingLike = await db.orm.public.PostLike
      .where({
        postId,
        userId,
      })
      .all();

    if (existingLike.length === 0) {
      throw new ConflictException(
        'You have not liked this post',
      );
    }

    await db.orm.public.PostLike
      .where({
        id: existingLike[0].id,
      })
      .delete();

    return {
      message: 'Post unliked successfully',
    };
  }

}