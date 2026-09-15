import {
  Controller,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async getNotifications(@Request() request: any) {
    return this.notificationsService.getUserNotifications(
      request.user.sub,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Request() request: any) {
    return this.notificationsService.getUnreadCount(
      request.user.sub,
    );
  }

  @Patch('read-all')
  async markAllAsRead(@Request() request: any) {
    return this.notificationsService.markAllAsRead(
      request.user.sub,
    );
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Request() request: any,
  ) {
    return this.notificationsService.markAsRead(
      Number(id),
      request.user.sub,
    );
  }
}
