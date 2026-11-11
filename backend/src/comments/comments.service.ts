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
  isBlockedEitherWay,
  isFollowing,
} from '../common/relations.js';

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
    const cleanContent = String(content ?? '').trim();
    if (!cleanContent) {
      throw new BadRequestException('Comment cannot be empty');
    }
    if (cleanContent.length > 1000) {
      throw new BadRequestException('Comment must be 1000 characters or fewer');
    }
    content = cleanContent;

    const posts = await db.orm.public.Post
      .where({ id: postId })
      .include('author')
      .all();

    if (posts.length === 0) {
      throw new NotFoundException('Post not found');
    }

    const post = posts[0];
    const policy = await this.commentPolicy(post, userId);
    if (!policy.canComment) {
      throw new ForbiddenException(policy.reason);
    }

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
        { actorId: userId, postId },
      );
    }

    void this.notificationsService.notifyMentions(userId, postId, [content], 'comment');

    return {
      message: 'Comment created successfully',
      comment,
    };
  }

  /**
   * Whether `viewerId` may comment on `post`, honouring the author's
   * "who can comment" setting, blocks and private accounts.
   */
  private async commentPolicy(
    post: {
      authorId: number;
      author?: { id: number; isPrivate?: boolean | null; commentPrivacy?: string | null } | null;
    },
    viewerId: number,
  ): Promise<{ canComment: boolean; policy: string; reason: string }> {
    const author =
      post.author ?? (await db.orm.public.User.where({ id: post.authorId }).first());
    const policy = author?.commentPrivacy ?? 'everyone';

    if (!author) return { canComment: false, policy, reason: 'Post not found' };
    if (author.id === viewerId) return { canComment: true, policy, reason: '' };

    if (await isBlockedEitherWay(viewerId, author.id)) {
      return { canComment: false, policy, reason: "You can't comment on this post" };
    }
    if (!(await canViewContent(viewerId, author))) {
      return { canComment: false, policy, reason: 'This account is private' };
    }
    if (policy === 'off') {
      return { canComment: false, policy, reason: 'Comments are turned off for this post' };
    }
    if (policy === 'followers' && !(await isFollowing(viewerId, author.id))) {
      return {
        canComment: false,
        policy,
        reason: 'Only followers can comment on this post',
      };
    }
    return { canComment: true, policy, reason: '' };
  }

  async getPostComments(postId: number, viewerId = 0) {
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

    const [allComments, blocked, policy] = await Promise.all([
      db.orm.public.Comment
        .where({ postId })
        .include('user')
        .orderBy([(c) => c.createdAt.asc(), (c) => c.id.asc()])
        .all(),
      getBlockedIds(viewerId),
      this.commentPolicy(post, viewerId),
    ]);
    const comments = allComments.filter((c) => !blocked.has(c.userId));

    return {
      postId,
      commentCount: comments.length,
      canComment: policy.canComment,
      commentPolicy: policy.policy,
      commentRestriction: policy.canComment ? null : policy.reason,
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
    if (cleanContent.length > 1000) {
      throw new BadRequestException('Comment must be 1000 characters or fewer');
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

    // The comment author, or the owner of the post, may remove a comment.
    if (comment.userId !== userId) {
      const post = await db.orm.public.Post
        .where({ id: comment.postId })
        .first();
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