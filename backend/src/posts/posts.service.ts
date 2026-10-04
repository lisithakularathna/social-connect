import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../prisma/db.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createPost(
    title: string,
    content: string | undefined,
    authorId: number,
    file?: { buffer: Buffer },
    backgroundColor?: string,
    fontSize?: number,
  ) {
    let imageUrl: string | undefined;

    if (file) {
      imageUrl = await this.cloudinaryService.uploadImage(
        file.buffer,
      );
    }

    const post = await db.orm.public.Post.create({
      title,
      content,
      imageUrl,
      backgroundColor,
      fontSize,
      authorId,
    });

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
    return { message: 'Post reposted successfully', post };
  }

  private async formatPosts(posts: any[], likerId: number) {
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
      let displayAuthor = post.author
        ? {
            id: post.author.id,
            username: post.author.username,
            name: post.author.name,
            email: post.author.email,
            profileImageUrl: post.author.profileImageUrl,
          }
        : {
            id: post.authorId,
            username: 'user',
            name: '',
            email: '',
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
              ...meta.originalAuthor,
              email: meta.originalAuthor.email || '',
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
              email: orig.author.email || '',
              profileImageUrl: orig.author.profileImageUrl || '',
            };
          }
        }
      }

      return {
        id: post.id,
        title: displayTitle,
        content: displayContent,
        imageUrl: post.imageUrl,
        backgroundColor: post.backgroundColor,
        fontSize: post.fontSize,
        authorId: displayAuthor.id,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
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

    const [posts, totalCount] = await Promise.all([
      db.orm.public.Post
        .include('author')
        .include('likes')
        .include('comments')
        .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()])
        .limit(safeLimit)
        .offset(offset)
        .all(),
      db.orm.public.Post.all().then(posts => posts.length),
    ]);

    const totalCountNumber = Number(totalCount);
    const formattedPosts = await this.formatPosts(posts, likerId);

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

  async getUserPosts(userId: number) {
    const posts = await db.orm.public.Post
      .where({ authorId: userId })
      .include('author')
      .include('likes')
      .include('comments')
      .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()])
      .all();

    return this.formatPosts(posts, 0);
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
      updateData.title = title;
    }

    if (content !== undefined) {
      updateData.content = content;
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

    await db.orm.public.Post
      .where({ id: postId })
      .delete();

    return {
      message: 'Post deleted successfully',
    };
  }
}