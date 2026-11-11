import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
      backgroundColor?: string;
      fontSize?: number;
    },

    @UploadedFile() file: { buffer: Buffer } | undefined,

    @Request() request: any,
  ) {
    return this.postsService.createPost(
      body.title,
      body.content,
      request.user.sub,
      file,
      body.backgroundColor,
      body.fontSize,
    );
  }

  @Post('repost/:id')
  async repost(@Param('id') id: string, @Request() request: any) {
    return this.postsService.repostPost(parseInt(id, 10), request.user.sub);
  }

  @Get()
  async getAllPosts(
    @Request() request: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('scope') scope?: string,
  ) {
    return this.postsService.getAllPosts(
      request.user?.sub,
      page !== undefined ? parseInt(page, 10) : undefined,
      limit !== undefined ? parseInt(limit, 10) : undefined,
      scope === 'following' ? 'following' : 'all',
    );
  }

  @Get('saved')
  async getSaved(@Request() request: any) {
    return this.postsService.getSavedPosts(request.user.sub);
  }

  /** Upload a saved list kept on the device by older app versions. */
  @Post('saved/import')
  async importSaved(@Request() request: any, @Body() body: { postIds?: unknown }) {
    return this.postsService.importSaved(request.user.sub, body?.postIds);
  }

  @Get('search')
  async search(@Request() request: any, @Query('q') q?: string) {
    return this.postsService.searchPosts(q ?? '', request.user.sub);
  }

  @Post(':id/save')
  async save(@Param('id', ParseIntPipe) id: number, @Request() request: any) {
    return this.postsService.savePost(id, request.user.sub);
  }

  @Delete(':id/save')
  async unsave(@Param('id', ParseIntPipe) id: number, @Request() request: any) {
    return this.postsService.unsavePost(id, request.user.sub);
  }

  @Get('me')
  async getMyPosts(@Request() request: any) {
    return this.postsService.getMyPosts(
      request.user.sub,
    );
  }

  @Get('user/:id')
  async getUserPosts(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.postsService.getUserPosts(id, request.user?.sub);
  }

  @Get(':id')
  async getPost(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.postsService.getPostById(id, request.user?.sub);
  }

  @Patch(':id')
  async updatePost(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      content?: string;
      backgroundColor?: string;
      fontSize?: number;
    },
    @Request() request: any,
  ) {
    return this.postsService.updatePost(
      parseInt(id),
      request.user.sub,
      body.title,
      body.content,
      body.backgroundColor,
      body.fontSize,
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