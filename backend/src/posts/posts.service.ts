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
    const posts = await db.orm.public.Post.where({ id: postId }).all();
    const original = posts[0] ?? null;
    if (!original) throw new NotFoundException('Post not found');
    const title = `Reposted: ${original.title}`.slice(0, 255);
    const content = original.content ? `${original.content}\n\n↻ Reposted from post #${original.id}` : `↻ Reposted from post #${original.id}`;
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

    return {
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        backgroundColor: post.backgroundColor,
        fontSize: post.fontSize,
        authorId: post.authorId,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        likesCount: Array.isArray(post.likes) ? post.likes.length : 0,
        isLiked: Array.isArray(post.likes) ? post.likes.some((l: any) => l.userId === likerId) : false,
        commentsCount: Array.isArray(post.comments) ? post.comments.length : 0,
        author: {
          id: post.author.id,
          username: post.author.username,
          name: post.author.name,
          email: post.author.email,
          profileImageUrl: post.author.profileImageUrl,
        },
      })),
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
      .all();

    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      authorId: post.authorId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));
  }

  async getUserPosts(userId: number) {
    const posts = await db.orm.public.Post
      .where({ authorId: userId })
      .all();

    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      authorId: post.authorId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));
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