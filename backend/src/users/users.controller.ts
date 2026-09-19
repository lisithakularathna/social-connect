import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard.js';

import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  async getMe(@Request() request: any) {
    const user = await this.usersService.findById(
      request.user.sub,
    );
    const stats = await this.usersService.getFollowStats(
      request.user.sub,
    );

    return {
      id: user?.id,
      email: user?.email,
      username: user?.username,
      name: user?.name,
      bio: user?.bio,
      profileImageUrl: user?.profileImageUrl,
      followersCount: stats.followersCount,
      followingCount: stats.followingCount,
    };
  }

  @Patch('me')
  @UseInterceptors(FileInterceptor('image'))
  async updateProfile(
    @Body()
    body: {
      name?: string;
      username?: string;
      bio?: string;
    },
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Request() request: any,
  ) {
    return this.usersService.updateProfile(
      request.user.sub,
      body.name,
      body.username,
      body.bio,
      file,
    );
  }

  @Delete('me')
  async deleteMe(@Request() request: any) {
    return this.usersService.deleteAccount(request.user.sub);
  }

  @Get('search')
  async searchUsers(
    @Query('q') q: string,
    @Request() request: any,
  ) {
    return this.usersService.searchUsers(
      q ?? '',
      request.user.sub,
    );
  }

  @Post(':id/follow')
  async toggleFollow(
    @Param('id') id: string,
    @Request() request: any,
  ) {
    return this.usersService.toggleFollow(
      request.user.sub,
      parseInt(id),
    );
  }

  @Get(':id/follow-status')
  async getFollowStatus(
    @Param('id') id: string,
    @Request() request: any,
  ) {
    return this.usersService.getFollowStats(
      parseInt(id),
      request.user.sub,
    );
  }

  @Get(':id/followers')
  async getFollowers(
    @Param('id') id: string,
  ) {
    return this.usersService.getFollowers(
      parseInt(id),
    );
  }

  @Get(':id/following')
  async getFollowing(
    @Param('id') id: string,
  ) {
    return this.usersService.getFollowing(
      parseInt(id),
    );
  }

  @Get(':id')
  async getUserById(
    @Param('id') id: string,
    @Request() request: any,
  ) {
    const targetUserId = parseInt(id);
    const user = await this.usersService.findById(
      targetUserId,
    );
    const stats = await this.usersService.getFollowStats(
      targetUserId,
      request.user?.sub,
    );

    return {
      id: user?.id,
      username: user?.username,
      name: user?.name,
      bio: user?.bio,
      profileImageUrl: user?.profileImageUrl,
      followersCount: stats.followersCount,
      followingCount: stats.followingCount,
      isFollowing: stats.isFollowing,
    };
  }
}