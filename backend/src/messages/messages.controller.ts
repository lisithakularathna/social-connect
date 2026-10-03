import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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

  @Post('keys/public')
  async savePublicKey(
    @Request() request: any,
    @Body('publicKey') publicKey: string,
  ) {
    return this.messagesService.savePublicKey(
      request.user.sub,
      publicKey,
    );
  }

  @Get('keys/public/:userId')
  async getPublicKey(
    @Param('userId') userId: string,
  ) {
    return this.messagesService.getPublicKey(
      Number(userId),
    );
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

  @Patch('message/:messageId')
  async editMessage(
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
    @Request() request: any,
  ) {
    return this.messagesService.editMessage(
      Number(messageId),
      Number(request.user.sub),
      body.content,
    );
  }

  @Patch(':messageId')
  async editMessageDirect(
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
    @Request() request: any,
  ) {
    return this.messagesService.editMessage(
      Number(messageId),
      Number(request.user.sub),
      body.content,
    );
  }

  @Delete('message/:messageId')
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Request() request: any,
  ) {
    return this.messagesService.deleteMessage(
      Number(messageId),
      Number(request.user.sub),
    );
  }

  @Delete(':messageId')
  async deleteMessageDirect(
    @Param('messageId') messageId: string,
    @Request() request: any,
  ) {
    return this.messagesService.deleteMessage(
      Number(messageId),
      Number(request.user.sub),
    );
  }
}
