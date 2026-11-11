import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import {
  extractMentions,
  isBlockedEitherWay,
  resolveMentionedUsers,
} from '../common/relations.js';

/** Which user preference column gates each notification type. */
const PREF_FOR_TYPE: Record<string, string> = {
  like: 'notifyLikes',
  repost: 'notifyLikes',
  comment: 'notifyComments',
  follow: 'notifyFollows',
  follow_request: 'notifyFollows',
  follow_accept: 'notifyFollows',
  message: 'notifyMessages',
  mention: 'notifyMentions',
};

export interface NotificationLinks {
  actorId?: number;
  postId?: number;
}

@Injectable()
export class NotificationsService {
  /**
   * Creates a notification unless the recipient turned that type off or the
   * two users have blocked each other. Never throws: a failed notification
   * must not break the action that triggered it.
   */
  async createNotification(
    userId: number,
    type: string,
    message: string,
    links: NotificationLinks = {},
  ) {
    try {
      if (links.actorId && links.actorId === userId) return null;

      const recipient = await db.orm.public.User.where({ id: userId }).first();
      if (!recipient) return null;

      const prefKey = PREF_FOR_TYPE[type];
      if (prefKey && (recipient as Record<string, unknown>)[prefKey] === false) {
        return null;
      }

      if (links.actorId && (await isBlockedEitherWay(userId, links.actorId))) {
        return null;
      }

      return await db.orm.public.Notification.create({
        userId,
        type,
        message,
        isRead: false,
        actorId: links.actorId,
        postId: links.postId,
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
      return null;
    }
  }

  async getUserNotifications(userId: number) {
    const notifications = await db.orm.public.Notification
      .where({ userId })
      .orderBy([(n) => n.createdAt.desc(), (n) => n.id.desc()])
      .limit(200)
      .all();

    const actorIds = [
      ...new Set(
        notifications
          .map((n) => n.actorId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const actors = actorIds.length
      ? await db.orm.public.User
          .where((u) => u.id.in(actorIds))
          .select('id', 'username', 'name', 'profileImageUrl')
          .all()
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return notifications.map((n) => ({
      ...n,
      actor: n.actorId ? actorMap.get(n.actorId) ?? null : null,
    }));
  }

  async getUnreadCount(userId: number) {
    const notifications = await db.orm.public.Notification
      .where({ userId, isRead: false })
      .all();

    const byType: Record<string, number> = {};
    for (const n of notifications) {
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    }

    return { count: notifications.length, byType };
  }

  async markAsRead(id: number, userId: number) {
    const items = await db.orm.public.Notification
      .where({ id, userId })
      .all();

    if (items.length === 0) {
      throw new NotFoundException('Notification not found');
    }

    await db.orm.public.Notification
      .where({ id })
      .update({ isRead: true });

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: number, type?: string) {
    const filter = type
      ? { userId, isRead: false, type }
      : { userId, isRead: false };

    await db.orm.public.Notification
      .where(filter)
      .updateAll({ isRead: true });

    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(id: number, userId: number) {
    const item = await db.orm.public.Notification
      .where({ id, userId })
      .first();

    if (!item) {
      throw new NotFoundException('Notification not found');
    }

    await db.orm.public.Notification.where({ id }).delete();
    return { message: 'Notification deleted', id };
  }

  async clearAll(userId: number) {
    await db.orm.public.Notification.where({ userId }).deleteAll();
    return { message: 'All notifications cleared' };
  }

  /** Notify everyone @mentioned in a post or comment. */
  async notifyMentions(
    actorId: number,
    postId: number,
    texts: Array<string | null | undefined>,
    where: 'post' | 'comment',
  ) {
    try {
      const names = extractMentions(...texts);
      if (names.length === 0) return;
      const [users, actor] = await Promise.all([
        resolveMentionedUsers(names),
        db.orm.public.User.where({ id: actorId }).first(),
      ]);
      const actorName = actor?.name || actor?.username || 'Someone';
      for (const user of users.slice(0, 20)) {
        if (user.id === actorId) continue;
        await this.createNotification(
          user.id,
          'mention',
          `${actorName} mentioned you in a ${where}`,
          { actorId, postId },
        );
      }
    } catch (err) {
      console.error('Failed to send mention notifications:', err);
    }
  }

  /** Remove stale follow-request notifications once a request is handled. */
  async removeFollowRequestNotifications(targetId: number, requesterId: number) {
    await db.orm.public.Notification
      .where({ userId: targetId, type: 'follow_request', actorId: requesterId })
      .deleteAll();
  }
}
