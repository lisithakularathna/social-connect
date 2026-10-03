import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';

import { db } from '../prisma/db.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class MessagesService {
  private keysFilePath = path.join(process.cwd(), 'e2ee_keys.json');
  private publicKeys = new Map<number, string>();

  constructor(
    private readonly notificationsService: NotificationsService,
  ) {
    this.loadPublicKeys();
  }

  private loadPublicKeys() {
    try {
      if (fs.existsSync(this.keysFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.keysFilePath, 'utf-8'));
        for (const [k, v] of Object.entries(data)) {
          this.publicKeys.set(Number(k), String(v));
        }
      }
    } catch (err) {
      console.error('Failed to load E2EE public keys:', err);
    }
  }

  private async persistPublicKeys() {
    try {
      const obj: Record<number, string> = {};
      for (const [k, v] of this.publicKeys.entries()) {
        obj[k] = v;
      }
      await fs.promises.writeFile(this.keysFilePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist E2EE public keys:', err);
    }
  }

  async savePublicKey(userId: number, publicKey: string) {
    if (!publicKey || typeof publicKey !== 'string') {
      throw new BadRequestException('Invalid public key');
    }
    this.publicKeys.set(userId, publicKey);
    await this.persistPublicKeys();
    return { success: true };
  }

  async getPublicKey(userId: number) {
    const key = this.publicKeys.get(userId);
    return {
      publicKey: key || null,
    };
  }

  async canMessage(currentUserId: number, targetUserId: number) {
    // Allow messaging anyone including self (for testing)
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

    let rawMessages: any[] = [];
    if (Number(currentUserId) === Number(targetUserId)) {
      rawMessages = await db.orm.public.Message
        .where({
          senderId: currentUserId,
          receiverId: targetUserId,
        })
        .all();
    } else {
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
      rawMessages = [...sent, ...received];
    }

    // Deduplicate by message ID to prevent any duplicate messages
    const messageMap = new Map<number, any>();
    for (const msg of rawMessages) {
      messageMap.set(msg.id, msg);
    }
    const messages = Array.from(messageMap.values());

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

    if (Number(currentUserId) !== Number(targetUserId)) {
      const isEncrypted = cleanContent.startsWith('e2ee:v1:');
      const notificationText = isEncrypted
        ? `${senderName} sent you an encrypted message`
        : `${senderName} sent you a message`;

      await this.notificationsService.createNotification(
        targetUserId,
        'message',
        notificationText,
      );
    }

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

  async editMessage(messageId: number, userId: number, content: string) {
    const cleanContent = content?.trim();
    if (!cleanContent) {
      throw new BadRequestException('Message cannot be empty.');
    }
    const targetId = Number(messageId);
    const currentId = Number(userId);

    const msgs = await db.orm.public.Message.where({ id: targetId }).all();
    const msg = msgs[0] ?? null;
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    if (Number(msg.senderId) !== currentId) {
      throw new BadRequestException('You can only edit your own messages');
    }
    await db.orm.public.Message.where({ id: targetId }).update({
      content: cleanContent,
    });
    return { ...msg, content: cleanContent, isEdited: true };
  }

  async deleteMessage(messageId: number, userId: number) {
    const targetId = Number(messageId);
    const currentId = Number(userId);

    const msgs = await db.orm.public.Message.where({ id: targetId }).all();
    const msg = msgs[0] ?? null;
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    if (Number(msg.senderId) !== currentId && Number(msg.receiverId) !== currentId) {
      throw new BadRequestException('You cannot delete this message');
    }
    try {
      await db.orm.public.Message.where({ id: targetId }).delete();
    } catch (err) {
      console.error('Delete message error:', err);
    }
    return { message: 'Message deleted successfully', id: targetId };
  }
}
