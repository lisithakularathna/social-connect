import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
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
      registerDto.email,
      registerDto.username,
      registerDto.password,
      registerDto.name,
    );
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(
      loginDto.email,
      loginDto.password,
    );
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  changePassword(@Request() request: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(request.user.sub, body.currentPassword, body.newPassword);
  }

  @Post('google')
  googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body.idToken);
  }
}