import { Module } from '@nestjs/common';


import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PostsModule } from './posts/posts.module.js';
import { LikesModule } from './likes/likes.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { FollowsModule } from './follows/follows.module.js';
import { MessagesModule } from './messages/messages.module.js';



@Module({
  imports: [
    AuthModule,
    UsersModule,
    PostsModule,
    LikesModule,
    CommentsModule,
    CloudinaryModule,
    NotificationsModule,
    FollowsModule,
    MessagesModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}