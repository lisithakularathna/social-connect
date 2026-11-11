import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from '../auth/jwt.constants.js';

import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
    }),
    CloudinaryModule,
    NotificationsModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
