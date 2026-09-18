import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [
    JwtModule.register({
      secret: 'social-connect-secret-key',
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
