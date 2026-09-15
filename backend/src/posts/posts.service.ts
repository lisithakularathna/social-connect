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
      authorId,
    });

    return {
      message: 'Post created successfully',
      post,
    };
  }

  async getAllPosts(currentUserId?: number) {
    const posts = await db.orm.public.Post
      .include('author')
      .all();

    const allLikes = await db.orm.public.PostLike.all();
    const allComments = await db.orm.public.Comment.all();

    return posts
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )
      .map((post) => {
        const postLikes = allLikes.filter((l) => l.postId === post.id);
        const postComments = allComments.filter((c) => c.postId === post.id);

        return {
          id: post.id,
          title: post.title,
          content: post.content,
          imageUrl: post.imageUrl,
          authorId: post.authorId,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          likesCount: postLikes.length,
          isLiked: currentUserId
            ? postLikes.some((l) => l.userId === currentUserId)
            : false,
          commentsCount: postComments.length,
          author: {
            id: post.author.id,
            username: post.author.username,
            name: post.author.name,
            email: post.author.email,
            profileImageUrl: post.author.profileImageUrl,
          },
        };
      });
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
    } = {};

    if (title !== undefined) {
      updateData.title = title;
    }

    if (content !== undefined) {
      updateData.content = content;
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