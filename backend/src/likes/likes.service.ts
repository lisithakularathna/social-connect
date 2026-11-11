import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  canViewContent,
  getBlockedIds,
  isBlockedEitherWay,
} from '../common/relations.js';

@Injectable()
export class LikesService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  /** The post plus a visibility check (404 when the viewer can't see it). */
  private async visiblePost(postId: number, viewerId: number) {
    const post = await db.orm.public.Post
      .where({ id: postId })
      .include('author')
      .first();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (
      post.authorId !== viewerId &&
      ((await isBlockedEitherWay(viewerId, post.authorId)) ||
        !(await canViewContent(viewerId, post.author)))
    ) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async likePost(postId: number, userId: number) {
    const post = await this.visiblePost(postId, userId);

    const existingLike = await db.orm.public.PostLike
      .where({ postId, userId })
      .first();

    if (existingLike) {
      throw new ConflictException('You already liked this post');
    }

    const like = await db.orm.public.PostLike.create({ postId, userId });

    if (post.authorId !== userId) {
      const liker = await db.orm.public.User.where({ id: userId }).first();
      const likerName = liker?.name || liker?.username || 'Someone';
      const title =
        post.title.length > 40 ? `${post.title.slice(0, 40)}…` : post.title;

      await this.notificationsService.createNotification(
        post.authorId,
        'like',
        `${likerName} liked your post "${title}"`,
        { actorId: userId, postId },
      );
    }

    return {
      message: 'Post liked successfully',
      like,
    };
  }

  async getPostLikes(postId: number, viewerId = 0) {
    const post = await this.visiblePost(postId, viewerId);

    // Authors can hide like counts (and so the likers list) from others.
    if (post.author?.hideLikeCounts && post.authorId !== viewerId) {
      return { postId, likeCount: null, hidden: true, likes: [] };
    }

    const [likes, blocked] = await Promise.all([
      db.orm.public.PostLike
        .where({ postId })
        .include('user')
        .orderBy((l) => l.createdAt.desc())
        .all(),
      getBlockedIds(viewerId),
    ]);
    const visible = likes.filter((l) => !blocked.has(l.userId));

    return {
      postId,
      likeCount: likes.length,
      hidden: false,
      likes: visible.map((like) => ({
        id: like.id,
        userId: like.userId,
        username: like.user.username,
        name: like.user.name,
        profileImageUrl: like.user.profileImageUrl,
        createdAt: like.createdAt,
      })),
    };
  }

  async unlikePost(postId: number, userId: number) {
    const existingLike = await db.orm.public.PostLike
      .where({ postId, userId })
      .first();

    if (!existingLike) {
      throw new ConflictException('You have not liked this post');
    }

    await db.orm.public.PostLike.where({ id: existingLike.id }).delete();

    return {
      message: 'Post unliked successfully',
    };
  }
}
