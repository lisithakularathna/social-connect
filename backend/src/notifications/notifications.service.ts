import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';

@Injectable()
export class NotificationsService {
  async createNotification(
    userId: number,
    type: string,
    message: string,
  ) {
    return db.orm.public.Notification.create({
      userId,
      type,
      message,
      isRead: false,
    });
  }

  async getUserNotifications(userId: number) {
    const notifications = await db.orm.public.Notification
      .where({ userId })
      .all();

    // Sort newest first
    return notifications.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
  }

  async getUnreadCount(userId: number) {
    const notifications = await db.orm.public.Notification
      .where({ userId, isRead: false })
      .all();

    return { count: notifications.length };
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

  async markAllAsRead(userId: number) {
    const unread = await db.orm.public.Notification
      .where({ userId, isRead: false })
      .all();

    for (const item of unread) {
      await db.orm.public.Notification
        .where({ id: item.id })
        .update({ isRead: true });
    }

    return { message: 'All notifications marked as read' };
  }
}
