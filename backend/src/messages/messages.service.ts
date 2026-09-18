import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  async canMessage(currentUserId: number, targetUserId: number) {
    if (currentUserId === targetUserId) {
      return false;
    }

    // Any user can message any other user
    return true;
  }

  async getMessages(
    currentUserId: number,
    targetUserId: number,
  ) {
    const targetUser = await db.orm.public.User
      .where({ id: targetUserId })
      .all();

    if (targetUser.length === 0) {
      throw new NotFoundException('User not found');
    }

    const allowed = await this.canMessage(
      currentUserId,
      targetUserId,
    );

    if (!allowed) {
      throw new BadRequestException(
        'You can message this user only after you both follow each other.',
      );
    }

    const [sent, received] = await Promise.all([
      db.orm.public.Message
        .where({
          senderId: currentUserId,
          receiverId: targetUserId,
        })
        .all(),

      db.orm.public.Message
        .where({
          senderId: targetUserId,
          receiverId: currentUserId,
        })
        .all(),
    ]);

    const messages = [...sent, ...received];

    messages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime(),
    );

    return messages;
  }

  async sendMessage(
    currentUserId: number,
    targetUserId: number,
    content: string,
  ) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException(
        'You cannot message yourself.',
      );
    }

    const cleanContent = content?.trim();

    if (!cleanContent) {
      throw new BadRequestException(
        'Message cannot be empty.',
      );
    }

    const targetUser = await db.orm.public.User
      .where({ id: targetUserId })
      .all();

    if (targetUser.length === 0) {
      throw new NotFoundException('User not found');
    }

    const allowed = await this.canMessage(
      currentUserId,
      targetUserId,
    );

    if (!allowed) {
      throw new BadRequestException(
        'You can message this user only after you both follow each other.',
      );
    }

    const message =
      await db.orm.public.Message.create({
        content: cleanContent,
        senderId: currentUserId,
        receiverId: targetUserId,
      });

    const sender = await db.orm.public.User
      .where({ id: currentUserId })
      .all();

    const senderName =
      sender[0]?.username ||
      sender[0]?.name ||
      'Someone';

    await this.notificationsService.createNotification(
      targetUserId,
      'message',
      `${senderName} sent you a message`,
    );

    return message;
  }

  async getConversations(currentUserId: number) {
    const [sent, received, following] = await Promise.all([
      db.orm.public.Message
        .where({ senderId: currentUserId })
        .all(),

      db.orm.public.Message
        .where({ receiverId: currentUserId })
        .all(),
        
      db.orm.public.Follow
        .where({ followerId: currentUserId })
        .all(),
    ]);

    const allMessages = [...sent, ...received];
    const conversationMap = new Map<number, any>();

    for (const message of allMessages) {
      const otherUserId =
        message.senderId === currentUserId
          ? message.receiverId
          : message.senderId;

      const existing = conversationMap.get(otherUserId);

      if (
        !existing ||
        new Date(message.createdAt).getTime() >
          new Date(existing.createdAt).getTime()
      ) {
        conversationMap.set(otherUserId, message);
      }
    }
    
    // Also add people we follow if they aren't in the conversation map yet
    for (const f of following) {
      if (!conversationMap.has(f.followingId)) {
        conversationMap.set(f.followingId, {
          id: 0,
          content: 'Say hi!',
          senderId: currentUserId,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const userIds = Array.from(conversationMap.keys());

    if (userIds.length === 0) {
      return [];
    }

    const users = await db.orm.public.User.all();

    return userIds
      .map((userId) => {
        const user = users.find((u) => u.id === userId);
        const lastMessage = conversationMap.get(userId);

        if (!user) return null;

        return {
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            profileImageUrl: user.profileImageUrl,
          },
          lastMessage: {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
          },
        };
      })
      .filter(Boolean);
  }
}
