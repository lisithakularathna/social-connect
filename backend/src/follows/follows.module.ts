import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FollowsController } from './follows.controller.js';
import { FollowsService } from './follows.service.js';

@Module({
  imports: [
    JwtModule.register({
      secret: 'social-connect-secret-key',
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
