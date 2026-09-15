import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard.js';
import { PostsService } from './posts.service.js';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async createPost(
    @Body()
    body: {
      title: string;
      content?: string;
    },

    @UploadedFile() file: { buffer: Buffer } | undefined,

    @Request() request: any,
  ) {
    return this.postsService.createPost(
      body.title,
      body.content,
      request.user.sub,
      file,
    );
  }

  @Get()
  async getAllPosts(@Request() request: any) {
    return this.postsService.getAllPosts(request.user?.sub);
  }

  @Get('me')
  async getMyPosts(@Request() request: any) {
    return this.postsService.getMyPosts(
      request.user.sub,
    );
  }

  @Get('user/:id')
  async getUserPosts(
    @Param('id') id: string,
  ) {
    return this.postsService.getUserPosts(
      parseInt(id),
    );
  }

  @Patch(':id')
  async updatePost(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      content?: string;
    },
    @Request() request: any,
  ) {
    return this.postsService.updatePost(
      parseInt(id),
      request.user.sub,
      body.title,
      body.content,
    );
  }

  @Delete(':id')
  async deletePost(
    @Param('id') id: string,
    @Request() request: any,
  ) {
    return this.postsService.deletePost(
      parseInt(id),
      request.user.sub,
    );
  }
}