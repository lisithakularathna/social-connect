import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard.js';

import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Me ────────────────────────────────────────────────────

  @Get('me')
  async getMe(@Request() request: any) {
    const me = await this.usersService.getMe(request.user.sub);
    if (!me) {
      // Token belongs to a deleted account: make clients sign out.
      throw new UnauthorizedException('Account no longer exists');
    }
    return me;
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
      body?.name,
      body?.username,
      body?.bio,
      file,
    );
  }

  @Delete('me')
  async deleteMe(@Request() request: any) {
    return this.usersService.deleteAccount(request.user.sub);
  }

  @Delete('me/avatar')
  async removeAvatar(@Request() request: any) {
    return this.usersService.removeAvatar(request.user.sub);
  }

  @Get('me/settings')
  async getSettings(@Request() request: any) {
    return this.usersService.getSettings(request.user.sub);
  }

  @Patch('me/settings')
  async updateSettings(@Request() request: any, @Body() body: any) {
    return this.usersService.updateSettings(request.user.sub, body);
  }

  @Get('me/blocked')
  async getBlocked(@Request() request: any) {
    return this.usersService.getBlockedUsers(request.user.sub);
  }

  @Get('me/muted')
  async getMuted(@Request() request: any) {
    return this.usersService.getMutedUsers(request.user.sub);
  }

  /** Upload block/mute lists that older app versions stored on the device. */
  @Post('me/relations/import')
  async importRelations(@Request() request: any, @Body() body: any) {
    return this.usersService.importRelations(request.user.sub, body);
  }

  @Get('me/export')
  async exportData(@Request() request: any) {
    return this.usersService.exportData(request.user.sub);
  }

  // ── Discovery ─────────────────────────────────────────────

  @Get('search')
  async searchUsers(@Query('q') q: string, @Request() request: any) {
    return this.usersService.searchUsers(q ?? '', request.user.sub);
  }

  @Get('suggestions')
  async getSuggestions(
    @Request() request: any,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getSuggestions(
      request.user.sub,
      limit ? parseInt(limit, 10) || 8 : 8,
    );
  }

  // ── Other users ───────────────────────────────────────────

  @Get('by-username/:username')
  async getByUsername(
    @Param('username') username: string,
    @Request() request: any,
  ) {
    return this.usersService.getProfileByUsername(username, request.user.sub);
  }

  @Post(':id/follow')
  async toggleFollow(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.usersService.toggleFollow(request.user.sub, id);
  }

  @Get(':id/follow-status')
  async getFollowStatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.usersService.getFollowStats(id, request.user.sub);
  }

  @Get(':id/followers')
  async followers(@Param('id', ParseIntPipe) id: number, @Request() request: any) {
    return this.usersService.getFollowersList(id, request.user.sub);
  }

  @Get(':id/following')
  async following(@Param('id', ParseIntPipe) id: number, @Request() request: any) {
    return this.usersService.getFollowingList(id, request.user.sub);
  }

  @Post(':id/block')
  async block(@Param('id', ParseIntPipe) id: number, @Request() request: any) {
    return this.usersService.blockUser(request.user.sub, id);
  }

  @Delete(':id/block')
  async unblock(@Param('id', ParseIntPipe) id: number, @Request() request: any) {
    return this.usersService.unblockUser(request.user.sub, id);
  }

  @Post(':id/mute')
  async mute(@Param('id', ParseIntPipe) id: number, @Request() request: any) {
    return this.usersService.muteUser(request.user.sub, id);
  }

  @Delete(':id/mute')
  async unmute(@Param('id', ParseIntPipe) id: number, @Request() request: any) {
    return this.usersService.unmuteUser(request.user.sub, id);
  }

  @Get(':id')
  async getUserById(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: any,
  ) {
    return this.usersService.getProfile(id, request.user.sub);
  }
}
