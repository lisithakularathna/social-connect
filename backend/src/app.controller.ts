import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth/auth.guard.js';

@Controller()
@UseGuards(AuthGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

