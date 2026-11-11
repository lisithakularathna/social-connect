import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  canViewContent,
  getBlockedIds,
  getHiddenPrivateIds,
  getMutedIds,
  isBlockedEitherWay,
} from '../common/relations.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Tell everyone @mentioned in a post. */
  async notifyMentions(
    actorId: number,
    postId: number,
    texts: Array<string | null | undefined>,
    where: 'post' | 'comment',
  ) {
    return this.notificationsService.notifyMentions(actorId, postId, texts, where);
  }

  /** Author ids whose posts the viewer must not see in feeds. */
  private async excludedAuthorIds(viewerId: number) {
    const [blocked, muted, hiddenPrivate] = await Promise.all([
      getBlockedIds(viewerId),
      getMutedIds(viewerId),
      getHiddenPrivateIds(viewerId),
    ]);
    return {
      blocked,
      muted,
      hiddenPrivate,
      all: new Set([...blocked, ...muted, ...hiddenPrivate]),
    };
  }

  /** Visibility check for a single post owner (404 rather than 403). */
  private async assertCanSee(authorId: number, viewerId: number) {
    if (authorId === viewerId) return;
    const author = await db.orm.public.User.where({ id: authorId }).first();
    if (
      !author ||
      (await isBlockedEitherWay(viewerId, authorId)) ||
      !(await canViewContent(viewerId, author))
    ) {
      throw new NotFoundException('Post not found');
    }
  }

  async createPost(
    title: string,
    content: string | undefined,
    authorId: number,
    file?: { buffer: Buffer },
    backgroundColor?: string,
    fontSize?: number | string,
  ) {
    const cleanTitle = String(title ?? '').trim();
    const cleanContent = content ? String(content).trim() : undefined;

    if (!cleanTitle && !file) {
      throw new BadRequestException('Write something or add a photo to post');
    }
    if (cleanTitle.length > 255) {
      throw new BadRequestException('Title must be 255 characters or fewer');
    }
    if (cleanContent && cleanContent.length > 5000) {
      throw new BadRequestException('Post text must be 5000 characters or fewer');
    }

    let imageUrl: string | undefined;

    if (file) {
      imageUrl = await this.cloudinaryService.uploadImage(
        file.buffer,
      );
    }

    // Multipart bodies deliver numbers as strings.
    const parsedFontSize =
      fontSize !== undefined && fontSize !== '' ? Number(fontSize) : undefined;

    const post = await db.orm.public.Post.create({
      title: cleanTitle || 'Photo',
      content: cleanContent || undefined,
      imageUrl,
      backgroundColor: backgroundColor || undefined,
      fontSize: Number.isFinite(parsedFontSize)
        ? Math.min(Math.max(Math.round(parsedFontSize as number), 12), 48)
        : undefined,
      authorId,
    });

    void this.notifyMentions(authorId, post.id, [post.title, post.content], 'post');

    return {
      message: 'Post created successfully',
      post,
    };
  }

  async repostPost(postId: number, userId: number) {
    const posts = await db.orm.public.Post
      .where({ id: postId })
      .include('author')
      .all();
    const original = posts[0] ?? null;
    if (!original) throw new NotFoundException('Post not found');
    await this.assertCanSee(original.authorId, userId);
    if (original.author?.isPrivate && original.authorId !== userId) {
      throw new ForbiddenException("Posts from private accounts can't be reposted");
    }

    // Clean original title (in case someone reposts an existing repost)
    let cleanTitle = original.title.replace(/^Reposted:\s*/i, '').trim();
    let cleanContent = original.content || '';

    // Determine root author and root post id
    let rootAuthor = {
      id: original.author?.id || original.authorId,
      username: original.author?.username || 'user',
      name: original.author?.name || '',
      profileImageUrl: original.author?.profileImageUrl || '',
    };
    let rootPostId = original.id;

    const metaMatch = cleanContent.match(/\[REPOST_META:(.+?)\]/);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        if (meta.originalAuthor) rootAuthor = meta.originalAuthor;
        if (meta.originalPostId) rootPostId = meta.originalPostId;
        if (meta.cleanTitle) cleanTitle = meta.cleanTitle;
      } catch {}
    }

    cleanContent = cleanContent
      .replace(/\[REPOST_META:[^\]]+\]\s*/g, '')
      .replace(/\n*↻\s*Reposted from post #\d+/g, '')
      .trim();

    const repostMeta = {
      originalPostId: rootPostId,
      originalAuthor: rootAuthor,
      cleanTitle,
      cleanContent,
    };

    const title = `Reposted: ${cleanTitle}`.slice(0, 255);
    const content = `[REPOST_META:${JSON.stringify(repostMeta)}]\n${cleanContent}\n\n↻ Reposted from post #${rootPostId}`;

    const post = await db.orm.public.Post.create({
      title,
      content,
      imageUrl: original.imageUrl,
      backgroundColor: original.backgroundColor,
      fontSize: original.fontSize,
      authorId: userId,
    });

    if (rootAuthor.id && rootAuthor.id !== userId) {
      const reposter = await db.orm.public.User.where({ id: userId }).first();
      await this.notificationsService.createNotification(
        Number(rootAuthor.id),
        'repost',
        `${reposter?.name || reposter?.username || 'Someone'} reposted your post`,
        { actorId: userId, postId: post.id },
      );
    }
    return { message: 'Post reposted successfully', post };
  }

  private async formatPosts(posts: any[], likerId: number) {
    const savedIds = new Set<number>();
    if (likerId && posts.length > 0) {
      const saved = await db.orm.public.SavedPost
        .where({ userId: likerId })
        .where((s) => s.postId.in(posts.map((p) => p.id)))
        .all();
      for (const row of saved) savedIds.add(row.postId);
    }

    // Collect legacy IDs to fetch original post authors
    const legacyPostIdsToFetch = posts
      .map((p) => {
        const c = p.content || '';
        if (c.includes('[REPOST_META:')) return null;
        const m = c.match(/↻\s*Reposted from post #(\d+)/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((id): id is number => id !== null);

    const legacyMap = new Map<number, any>();
    if (legacyPostIdsToFetch.length > 0) {
      try {
        const results = await Promise.all(
          legacyPostIdsToFetch.map((id) =>
            db.orm.public.Post.where({ id }).include('author').all()
          )
        );
        for (const list of results) {
          if (list && list[0]) {
            legacyMap.set(list[0].id, list[0]);
          }
        }
      } catch (err) {
        console.error('Failed to lookup legacy repost originals:', err);
      }
    }

    return posts.map((post) => {
      let isRepost = false;
      let repostedBy: any = null;
      let displayTitle = post.title;
      let displayContent = post.content || '';
      // Never expose author emails in post payloads.
      let displayAuthor: {
        id: number;
        username: string;
        name: string;
        profileImageUrl: string;
      } = post.author
        ? {
            id: post.author.id,
            username: post.author.username,
            name: post.author.name,
            profileImageUrl: post.author.profileImageUrl,
          }
        : {
            id: post.authorId,
            username: 'user',
            name: '',
            profileImageUrl: '',
          };
      let originalPostId: number | null = null;

      const metaMatch = displayContent.match(/\[REPOST_META:(.+?)\]/);
      if (metaMatch) {
        try {
          const meta = JSON.parse(metaMatch[1]);
          isRepost = true;
          repostedBy = {
            id: post.author?.id || post.authorId,
            username: post.author?.username || 'user',
            name: post.author?.name || '',
            profileImageUrl: post.author?.profileImageUrl || '',
          };
          if (meta.originalAuthor) {
            displayAuthor = {
              id: meta.originalAuthor.id,
              username: meta.originalAuthor.username,
              name: meta.originalAuthor.name,
              profileImageUrl: meta.originalAuthor.profileImageUrl,
            };
          }
          if (meta.cleanTitle) displayTitle = meta.cleanTitle;
          if (meta.cleanContent !== undefined) displayContent = meta.cleanContent;
          if (meta.originalPostId) originalPostId = meta.originalPostId;
        } catch {}
      } else if (
        post.title.startsWith('Reposted:') ||
        displayContent.includes('↻ Reposted from post #')
      ) {
        isRepost = true;
        repostedBy = {
          id: post.author?.id || post.authorId,
          username: post.author?.username || 'user',
          name: post.author?.name || '',
          profileImageUrl: post.author?.profileImageUrl || '',
        };
        displayTitle = post.title.replace(/^Reposted:\s*/i, '').trim();
        displayContent = displayContent.replace(/\n*↻\s*Reposted from post #\d+/g, '').trim();
        const legacyMatch = (post.content || '').match(/↻\s*Reposted from post #(\d+)/);
        if (legacyMatch) {
          originalPostId = parseInt(legacyMatch[1], 10);
          const orig = legacyMap.get(originalPostId);
          if (orig && orig.author) {
            displayAuthor = {
              id: orig.author.id,
              username: orig.author.username,
              name: orig.author.name,
              profileImageUrl: orig.author.profileImageUrl || '',
            };
          }
        }
      }

      // Authors can hide like counts on their posts from everyone else.
      const likesHidden =
        Boolean(post.author?.hideLikeCounts) && post.authorId !== likerId;

      return {
        id: post.id,
        title: displayTitle,
        content: displayContent,
        imageUrl: post.imageUrl,
        backgroundColor: post.backgroundColor,
        fontSize: post.fontSize,
        authorId: displayAuthor.id,
        ownerId: post.authorId,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        likesHidden,
        isSaved: savedIds.has(post.id),
        likesCount: likesHidden
          ? null
          : Array.isArray(post.likes)
            ? post.likes.length
            : 0,
        isLiked: Array.isArray(post.likes)
          ? post.likes.some((l: any) => l.userId === likerId)
          : false,
        commentsCount: Array.isArray(post.comments) ? post.comments.length : 0,
        author: displayAuthor,
        isRepost,
        repostedBy,
        originalPostId,
      };
    });
  }

  async getAllPosts(
    currentUserId?: number,
    page?: number,
    limit?: number,
    scope: 'all' | 'following' = 'all',
  ) {
    const safePage =
      Number.isFinite(page) && (page as number) > 0
        ? Math.floor(page as number)
        : 1;

    // Cap the page size so a caller can't force the server to load the
    // entire feed in one request.
    const safeLimit =
      Number.isFinite(limit) && (limit as number) > 0
        ? Math.min(Math.floor(limit as number), 50)
        : 10;

    const offset = (safePage - 1) * safeLimit;

    // A sentinel that can never match a real user id, so the "did I like
    // this" branch below is always well-formed even for anonymous callers.
    const likerId = currentUserId ?? 0;

    let base = db.orm.public.Post;
    const excluded = await this.excludedAuthorIds(likerId);
    for (const id of excluded.all) {
      if (id === likerId) continue;
      base = base.where((p) => p.authorId.neq(id)) as typeof base;
    }

    if (scope === 'following' && currentUserId) {
      const follows = await db.orm.public.Follow
        .where({ followerId: currentUserId })
        .all();
      // Include the viewer's own posts so their feed never looks empty
      // right after they publish something.
      const authorIds = [currentUserId, ...follows.map((f) => f.followingId)];
      base = base.where((p) => p.authorId.in(authorIds)) as typeof base;
    }

    const [posts, totalCount] = await Promise.all([
      base
        .include('author')
        .include('likes')
        .include('comments')
        .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()])
        .limit(safeLimit)
        .offset(offset)
        .all(),
      // count() is only allowed inside include() in this ORM version.
      base.select('id').all().then((rows) => rows.length),
    ]);

    const totalCountNumber = Number(totalCount);
    // Reposts can surface someone the viewer blocked/muted or can't see.
    const formattedPosts = (await this.formatPosts(posts, likerId)).filter(
      (p) => !(p.isRepost && excluded.all.has(Number(p.author?.id))),
    );

    return {
      posts: formattedPosts,
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalCount: totalCountNumber,
        totalPages: Math.max(1, Math.ceil(totalCountNumber / safeLimit)),
        hasMore: offset + posts.length < totalCountNumber,
      },
    };
  }

  async getMyPosts(userId: number) {
    const posts = await db.orm.public.Post
      .where({ authorId: userId })
      .include('author')
      .include('likes')
      .include('comments')
      .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()])
      .all();

    return this.formatPosts(posts, userId);
  }

  async getUserPosts(userId: number, viewerId?: number) {
    const viewer = viewerId ?? 0;
    if (userId !== viewer) {
      const owner = await db.orm.public.User.where({ id: userId }).first();
      if (
        !owner ||
        (await isBlockedEitherWay(viewer, userId)) ||
        !(await canViewContent(viewer, owner))
      ) {
        // Private / blocked profiles show no posts (the profile itself says why).
        return [];
      }
    }

    const posts = await db.orm.public.Post
      .where({ authorId: userId })
      .include('author')
      .include('likes')
      .include('comments')
      .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()])
      .all();

    return this.formatPosts(posts, viewerId ?? 0);
  }

  async getPostById(postId: number, viewerId?: number) {
    const posts = await db.orm.public.Post
      .where({ id: postId })
      .include('author')
      .include('likes')
      .include('comments')
      .all();

    if (posts.length === 0) {
      throw new NotFoundException('Post not found');
    }
    await this.assertCanSee(posts[0].authorId, viewerId ?? 0);

    const [formatted] = await this.formatPosts(posts, viewerId ?? 0);
    return formatted;
  }

  // ── Saved posts ───────────────────────────────────────────

  async savePost(postId: number, userId: number) {
    const post = await db.orm.public.Post.where({ id: postId }).first();
    if (!post) throw new NotFoundException('Post not found');
    await this.assertCanSee(post.authorId, userId);
    const existing = await db.orm.public.SavedPost
      .where({ userId, postId })
      .first();
    if (!existing) {
      await db.orm.public.SavedPost.create({ userId, postId });
    }
    return { message: 'Post saved', isSaved: true };
  }

  async unsavePost(postId: number, userId: number) {
    await db.orm.public.SavedPost.where({ userId, postId }).deleteAll();
    return { message: 'Removed from saved', isSaved: false };
  }

  async getSavedPosts(userId: number) {
    const saved = await db.orm.public.SavedPost
      .where({ userId })
      .orderBy([(s) => s.createdAt.desc(), (s) => s.id.desc()])
      .all();
    if (saved.length === 0) return [];

    const order = new Map(saved.map((s, i) => [s.postId, i]));
    const posts = await db.orm.public.Post
      .where((p) => p.id.in([...order.keys()]))
      .include('author')
      .include('likes')
      .include('comments')
      .all();

    const excluded = await this.excludedAuthorIds(userId);
    const visible = posts.filter(
      (p) =>
        p.authorId === userId ||
        (!excluded.blocked.has(p.authorId) && !excluded.hiddenPrivate.has(p.authorId)),
    );
    const formatted = await this.formatPosts(visible, userId);
    return formatted.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  /** One-time upload of a saved list that older app versions kept locally. */
  async importSaved(userId: number, postIds: unknown) {
    const ids = (Array.isArray(postIds) ? postIds : [])
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v > 0)
      .slice(0, 500);
    let imported = 0;
    for (const id of ids) {
      try {
        await this.savePost(id, userId);
        imported++;
      } catch {
        /* deleted or not visible — skip */
      }
    }
    return { imported };
  }

  // ── Search ────────────────────────────────────────────────

  async searchPosts(query: string, viewerId: number) {
    const term = String(query ?? '').trim();
    if (term.length < 2) return [];
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;

    const [byTitle, byContent] = await Promise.all([
      db.orm.public.Post.where((p) => p.title.ilike(pattern))
        .include('author').include('likes').include('comments')
        .orderBy([(p) => p.createdAt.desc()]).limit(40).all(),
      db.orm.public.Post.where((p) => p.content.ilike(pattern))
        .include('author').include('likes').include('comments')
        .orderBy([(p) => p.createdAt.desc()]).limit(40).all(),
    ]);

    const excluded = await this.excludedAuthorIds(viewerId);
    const seen = new Set<number>();
    const merged = [...byTitle, ...byContent]
      .filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return (
          p.authorId === viewerId ||
          (!excluded.blocked.has(p.authorId) && !excluded.hiddenPrivate.has(p.authorId))
        );
      })
      // Search shows originals, not reposts of them.
      .filter((p) => !p.title.startsWith('Reposted:'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);

    return this.formatPosts(merged, viewerId);
  }

  async updatePost(
    postId: number,
    userId: number,
    title: string | undefined,
    content: string | undefined,
    backgroundColor: string | undefined,
    fontSize: number | undefined,
  ) {
    const posts = await db.orm.public.Post
      .where({ id: postId })
      .all();

    const post = posts[0] ?? null;

    if (!post) {
      throw new NotFoundException(
        'Post not found',
      );
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only edit your own posts',
      );
    }

    const updateData: {
      title?: string;
      content?: string;
      backgroundColor?: string;
      fontSize?: number;
    } = {};

    if (title !== undefined) {
      const cleanTitle = String(title).trim();
      if (!cleanTitle) {
        throw new BadRequestException('Title cannot be empty');
      }
      updateData.title = cleanTitle.slice(0, 255);
    }

    if (content !== undefined) {
      updateData.content = String(content).trim().slice(0, 5000);
    }

    if (backgroundColor !== undefined) {
      updateData.backgroundColor = backgroundColor;
    }

    if (fontSize !== undefined) {
      updateData.fontSize = Math.min(Math.max(Math.round(fontSize), 16), 48);
    }

    await db.orm.public.Post
      .where({ id: postId })
      .update(updateData);

    return {
      message: 'Post updated successfully',
    };
  }

  async deletePost(
    postId: number,
    userId: number,
  ) {
    const posts = await db.orm.public.Post
      .where({ id: postId })
      .all();

    const post = posts[0] ?? null;

    if (!post) {
      throw new NotFoundException(
        'Post not found',
      );
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own posts',
      );
    }

    // Don't rely on ON DELETE CASCADE being present in every database.
    await db.orm.public.PostLike.where({ postId }).deleteAll();
    await db.orm.public.Comment.where({ postId }).deleteAll();

    await db.orm.public.Post
      .where({ id: postId })
      .delete();

    return {
      message: 'Post deleted successfully',
    };
  }
}