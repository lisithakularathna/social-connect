import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from '../auth/jwt.constants.js';

import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FollowsModule } from '../follows/follows.module.js';

@Module({
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
    }),
    CloudinaryModule,
    NotificationsModule,
    FollowsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}