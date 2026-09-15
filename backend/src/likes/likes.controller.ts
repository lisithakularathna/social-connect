import {
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';

import { LikesService } from './likes.service.js';

@Controller('likes')
@UseGuards(AuthGuard)
export class LikesController {

  constructor(
    private readonly likesService: LikesService,
  ) {}

  // Like a post
  @Post(':postId')
  async likePost(
    @Param('postId') postId: string,
    @Request() request: any,
  ) {
    return this.likesService.likePost(
      Number(postId),
      request.user.sub,
    );
  }

  // Get post likes
  @Get(':postId')
  async getPostLikes(
    @Param('postId') postId: string,
  ) {
    return this.likesService.getPostLikes(
      Number(postId),
    );
  }

  // Unlike a post
  @Delete(':postId')
  async unlikePost(
    @Param('postId') postId: string,
    @Request() request: any,
  ) {
    return this.likesService.unlikePost(
      Number(postId),
      request.user.sub,
    );
  }

}