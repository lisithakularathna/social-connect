import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CommentsService } from './comments.service.js';

@Controller('comments')
@UseGuards(AuthGuard)
export class CommentsController {

  constructor(
    private readonly commentsService: CommentsService,
  ) {}

  // Create comment
  @Post(':postId')
  async createComment(
    @Param('postId') postId: string,
    @Body() body: {
      content: string;
    },
    @Request() request: any,
  ) {
    return this.commentsService.createComment(
      body.content,
      Number(postId),
      request.user.sub,
    );
  }

  // Get post comments
  @Get(':postId')
  async getPostComments(
    @Param('postId') postId: string,
  ) {
    return this.commentsService.getPostComments(
      Number(postId),
    );
  }

  // Delete comment
  @Delete(':id')
  async deleteComment(
    @Param('id') id: string,
    @Request() request: any,
  ) {
    return this.commentsService.deleteComment(
      Number(id),
      request.user.sub,
    );
  }
}