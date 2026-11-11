import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from '../auth/jwt.constants.js';

import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
    }),
    NotificationsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}