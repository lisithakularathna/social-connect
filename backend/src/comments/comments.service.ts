import {
  BadRequestException,
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
      comments: comments.map((comment) => {
        const isEdited =
          comment.updatedAt &&
          comment.createdAt &&
          new Date(comment.updatedAt).getTime() -
            new Date(comment.createdAt).getTime() >
            1500;

        return {
          id: comment.id,
          content: comment.content,
          userId: comment.userId,
          username: comment.user?.username,
          name: comment.user?.name,
          profileImageUrl: comment.user?.profileImageUrl,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          isEdited: Boolean(isEdited),
        };
      }),
    };
  }

  async updateComment(commentId: number, content: string, userId: number) {
    const cleanContent = content?.trim();
    if (!cleanContent) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    const comments = await db.orm.public.Comment
      .where({ id: commentId })
      .all();

    if (comments.length === 0) {
      throw new NotFoundException('Comment not found');
    }

    const comment = comments[0];

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updated = await db.orm.public.Comment
      .where({ id: commentId })
      .update({
        content: cleanContent,
        updatedAt: new Date().toISOString(),
      });

    return {
      message: 'Comment updated successfully',
      comment: updated,
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

    // Only allow comment author to delete their own comment
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await db.orm.public.Comment
      .where({ id: commentId })
      .delete();

    return {
      message: 'Comment deleted successfully',
    };
  }
}