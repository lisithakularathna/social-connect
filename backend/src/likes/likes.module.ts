import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { LikesController } from './likes.controller.js';
import { LikesService } from './likes.service.js';

import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    JwtModule.register({
      secret: 'social-connect-secret-key',
    }),
    NotificationsModule,
  ],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}