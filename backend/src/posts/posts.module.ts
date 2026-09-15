import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';

@Module({
  imports: [
    JwtModule.register({
      secret: 'social-connect-secret-key',
    }),
    CloudinaryModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
