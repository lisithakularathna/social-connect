import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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

  // ── Follow requests (declared before ":userId" routes) ──

  @Get('requests')
  async incomingRequests(@Request() request: any) {
    return this.followsService.getIncomingRequests(request.user.sub);
  }

  @Post('requests/:userId/approve')
  async approve(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    return this.followsService.approveRequest(request.user.sub, userId);
  }

  @Post('requests/:userId/decline')
  async decline(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    return this.followsService.declineRequest(request.user.sub, userId);
  }

  /** Cancel a request I sent. */
  @Delete('requests/:userId')
  async cancel(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    return this.followsService.cancelRequest(request.user.sub, userId);
  }

  /** Remove someone who follows me. */
  @Delete('followers/:userId')
  async removeFollower(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    return this.followsService.removeFollower(request.user.sub, userId);
  }

  @Get('followers/:userId')
  async getFollowers(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    return this.followsService.getFollowers(userId, request.user?.sub);
  }

  @Get('following/:userId')
  async getFollowing(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    return this.followsService.getFollowing(userId, request.user?.sub);
  }

  @Get('stats/:userId')
  async getFollowStats(@Param('userId', ParseIntPipe) userId: number) {
    return this.followsService.getFollowStats(userId);
  }

  @Get('check/:userId')
  async checkIfFollowing(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    const [isFollowing, isRequested] = await Promise.all([
      this.followsService.isFollowing(request.user.sub, userId),
      this.followsService.isRequested(request.user.sub, userId),
    ]);
    return { isFollowing, isRequested };
  }

  @Post(':userId')
  async followUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    return this.followsService.followUser(request.user.sub, userId);
  }

  @Delete(':userId')
  async unfollowUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() request: any,
  ) {
    return this.followsService.unfollowUser(request.user.sub, userId);
  }
}
