import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class CommentsService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  async createComment(
    content: string,
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

    const comment = await db.orm.public.Comment.create({
      content,
      postId,
      userId,
    });

    if (post.authorId !== userId) {
      const users = await db.orm.public.User
        .where({ id: userId })
        .all();
      const commenter = users[0];
      const commenterName =
        commenter?.name || commenter?.username || 'Someone';

      const snippet =
        content.length > 30 ? `${content.substring(0, 30)}...` : content;

      await this.notificationsService.createNotification(
        post.authorId,
        'comment',
        `${commenterName} commented: "${snippet}"`,
      );
    }

    return {
      message: 'Comment created successfully',
      comment,
    };
  }

  async getPostComments(postId: number) {
    const comments = await db.orm.public.Comment
      .where({ postId })
      .include('user')
      .all();

    return {
      postId,
      commentCount: comments.length,
      comments: comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        userId: comment.userId,
        username: comment.user.username,
        name: comment.user.name,
        profileImageUrl: comment.user.profileImageUrl,
        createdAt: comment.createdAt,
      })),
    };
  }

  async deleteComment(commentId: number, userId: number) {
    const comments = await db.orm.public.Comment
      .where({ id: commentId })
      .all();

    if (comments.length === 0) {
      throw new NotFoundException('Comment not found');
    }

    const comment = comments[0];

    if (comment.userId !== userId) {
      const posts = await db.orm.public.Post
        .where({ id: comment.postId })
        .all();
      const post = posts[0];
      if (!post || post.authorId !== userId) {
        throw new ForbiddenException('You can only delete your own comments');
      }
    }

    await db.orm.public.Comment
      .where({ id: commentId })
      .delete();

    return {
      message: 'Comment deleted successfully',
    };
  }
}