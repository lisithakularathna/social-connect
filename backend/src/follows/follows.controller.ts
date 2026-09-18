import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { FollowsService } from './follows.service.js';

@Controller('follows')
@UseGuards(AuthGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  async followUser(
    @Param('userId') userId: string,
    @Request() request: any,
  ) {
    return this.followsService.followUser(
      request.user.sub,
      parseInt(userId, 10),
    );
  }

  @Delete(':userId')
  async unfollowUser(
    @Param('userId') userId: string,
    @Request() request: any,
  ) {
    return this.followsService.unfollowUser(
      request.user.sub,
      parseInt(userId, 10),
    );
  }

  @Get('followers/:userId')
  async getFollowers(@Param('userId') userId: string) {
    return this.followsService.getFollowers(parseInt(userId, 10));
  }

  @Get('following/:userId')
  async getFollowing(@Param('userId') userId: string) {
    return this.followsService.getFollowing(parseInt(userId, 10));
  }

  @Get('stats/:userId')
  async getFollowStats(@Param('userId') userId: string) {
    return this.followsService.getFollowStats(parseInt(userId, 10));
  }

  @Get('check/:userId')
  async checkIfFollowing(
    @Param('userId') userId: string,
    @Request() request: any,
  ) {
    const isFollowing = await this.followsService.isFollowing(
      request.user.sub,
      parseInt(userId, 10),
    );

    return { isFollowing };
  }
}
