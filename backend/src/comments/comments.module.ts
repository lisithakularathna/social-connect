import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    JwtModule.register({
      secret: 'social-connect-secret-key',
    }),
    NotificationsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}