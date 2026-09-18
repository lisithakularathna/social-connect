import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { MessagesService } from './messages.service.js';

@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
  ) {}

  @Get('conversations')
  async getConversations(
    @Request() request: any,
  ) {
    return this.messagesService.getConversations(
      request.user.sub,
    );
  }

  @Get('can-message/:userId')
  async canMessage(
    @Param('userId') userId: string,
    @Request() request: any,
  ) {
    const allowed =
      await this.messagesService.canMessage(
        request.user.sub,
        Number(userId),
      );

    return {
      canMessage: allowed,
    };
  }

  @Get(':userId')
  async getMessages(
    @Param('userId') userId: string,
    @Request() request: any,
  ) {
    return this.messagesService.getMessages(
      request.user.sub,
      Number(userId),
    );
  }

  @Post(':userId')
  async sendMessage(
    @Param('userId') userId: string,
    @Body() body: { content: string },
    @Request() request: any,
  ) {
    return this.messagesService.sendMessage(
      request.user.sub,
      Number(userId),
      body.content,
    );
  }
}
