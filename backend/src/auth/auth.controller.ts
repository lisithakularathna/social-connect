import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto/register.dto.js';
import { LoginDto } from './dto/login.dto/login.dto.js';

class GoogleLoginDto {
  idToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(
      registerDto?.email,
      registerDto?.username,
      registerDto?.password,
      registerDto?.name,
    );
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto?.email, loginDto?.password);
  }

  @Post('google')
  googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body?.idToken);
  }

  /** Second step of a 2FA login. */
  @Post('2fa/verify')
  @HttpCode(200)
  verifyTwoFactor(@Body() body: { challengeToken: string; code: string }) {
    return this.authService.verifyTwoFactorLogin(
      body?.challengeToken,
      body?.code,
    );
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  changePassword(
    @Request() request: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      request.user.sub,
      body?.currentPassword,
      body?.newPassword,
    );
  }

  @Patch('email')
  @UseGuards(AuthGuard)
  changeEmail(
    @Request() request: any,
    @Body() body: { email: string; password: string },
  ) {
    return this.authService.changeEmail(
      request.user.sub,
      body?.email,
      body?.password,
    );
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  logoutAll(@Request() request: any) {
    return this.authService.logoutAllDevices(request.user.sub);
  }

  @Get('2fa')
  @UseGuards(AuthGuard)
  twoFactorStatus(@Request() request: any) {
    return this.authService.twoFactorStatus(request.user.sub);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  setupTwoFactor(@Request() request: any) {
    return this.authService.setupTwoFactor(request.user.sub);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  enableTwoFactor(@Request() request: any, @Body() body: { code: string }) {
    return this.authService.enableTwoFactor(request.user.sub, body?.code);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  disableTwoFactor(
    @Request() request: any,
    @Body() body: { password: string; code: string },
  ) {
    return this.authService.disableTwoFactor(
      request.user.sub,
      body?.password,
      body?.code,
    );
  }
}
