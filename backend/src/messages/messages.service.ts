import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';

import { db } from '../prisma/db.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  getBlockedIds,
  isBlockedEitherWay,
  isFollowing,
  presenceFor,
} from '../common/relations.js';

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

  /**
   * Whether `currentUserId` may message `targetUserId`, honouring blocks and
   * the target's "who can message you" setting. Replies inside an existing
   * conversation the target started are always allowed.
   */
  async canMessage(currentUserId: number, targetUserId: number) {
    const result = await this.messagePermission(currentUserId, targetUserId);
    return result.allowed;
  }

  async messagePermission(
    currentUserId: number,
    targetUserId: number,
  ): Promise<{ allowed: boolean; reason: string | null }> {
    if (Number(currentUserId) === Number(targetUserId)) {
      return { allowed: true, reason: null };
    }
    const target = await db.orm.public.User.where({ id: targetUserId }).first();
    if (!target) return { allowed: false, reason: 'User not found' };

    if (await isBlockedEitherWay(currentUserId, targetUserId)) {
      return { allowed: false, reason: "You can't message this account" };
    }

    const privacy = target.messagePrivacy ?? 'everyone';
    if (privacy === 'everyone') return { allowed: true, reason: null };

    const theyMessagedMe = await db.orm.public.Message
      .where({ senderId: targetUserId, receiverId: currentUserId })
      .first();
    if (theyMessagedMe) return { allowed: true, reason: null };

    if (privacy === 'nobody') {
      return { allowed: false, reason: "This account isn't accepting messages" };
    }
    // 'followers': people who follow the target may message them.
    if (await isFollowing(currentUserId, targetUserId)) {
      return { allowed: true, reason: null };
    }
    return {
      allowed: false,
      reason: 'Only followers can message this account',
    };
  }

  /** Header info for a chat: presence + whether you can reply. */
  async getChatInfo(currentUserId: number, targetUserId: number) {
    const [target, viewer, permission] = await Promise.all([
      db.orm.public.User.where({ id: targetUserId }).first(),
      db.orm.public.User.where({ id: currentUserId }).first(),
      this.messagePermission(currentUserId, targetUserId),
    ]);
    if (!target) throw new NotFoundException('User not found');
    return {
      userId: target.id,
      canMessage: permission.allowed,
      reason: permission.reason,
      ...presenceFor(target, viewer),
    };
  }

  /** Total unread messages across conversations (for app badges). */
  async getUnreadCount(currentUserId: number) {
    const [unread, blocked] = await Promise.all([
      db.orm.public.Message
        .where({ receiverId: currentUserId })
        .where((m) => m.readAt.isNull())
        .all(),
      getBlockedIds(currentUserId),
    ]);
    const visible = unread.filter(
      (m) => m.senderId !== currentUserId && !blocked.has(m.senderId),
    );
    const byUser: Record<number, number> = {};
    for (const m of visible) byUser[m.senderId] = (byUser[m.senderId] ?? 0) + 1;
    return {
      count: visible.length,
      conversations: Object.keys(byUser).length,
      byUser,
    };
  }

  /** Mark everything `targetUserId` sent me as read. */
  async markConversationRead(currentUserId: number, targetUserId: number) {
    if (Number(currentUserId) === Number(targetUserId)) return { updated: 0 };
    await db.orm.public.Message
      .where({ senderId: targetUserId, receiverId: currentUserId })
      .where((m) => m.readAt.isNull())
      .updateAll({ readAt: new Date().toISOString() });
    return { ok: true };
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

    // Reading history is allowed even when you can no longer reply,
    // except between blocked users.
    if (await isBlockedEitherWay(currentUserId, targetUserId)) {
      throw new ForbiddenException("You can't view this conversation");
    }

    await this.markConversationRead(currentUserId, targetUserId);

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

    const permission = await this.messagePermission(
      currentUserId,
      targetUserId,
    );

    if (!permission.allowed) {
      throw new ForbiddenException(
        permission.reason ?? "You can't message this account",
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
        { actorId: currentUserId },
      );
    }

    return message;
  }

  async getConversations(currentUserId: number) {
    const [sent, received, following, blocked] = await Promise.all([
      db.orm.public.Message
        .where({ senderId: currentUserId })
        .all(),

      db.orm.public.Message
        .where({ receiverId: currentUserId })
        .all(),
        
      db.orm.public.Follow
        .where({ followerId: currentUserId })
        .all(),
      getBlockedIds(currentUserId),
    ]);

    const unreadBy = new Map<number, number>();
    for (const m of received) {
      if (!m.readAt && m.senderId !== currentUserId) {
        unreadBy.set(m.senderId, (unreadBy.get(m.senderId) ?? 0) + 1);
      }
    }

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
    const viewer = users.find((u) => u.id === currentUserId) ?? null;

    return userIds
      .map((userId) => {
        const user = users.find((u) => u.id === userId);
        const lastMessage = conversationMap.get(userId);

        if (!user || blocked.has(userId)) return null;

        return {
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            profileImageUrl: user.profileImageUrl,
            ...presenceFor(user, viewer),
          },
          lastMessage: {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
            readAt: lastMessage.readAt ?? null,
          },
          unreadCount: unreadBy.get(userId) ?? 0,
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
