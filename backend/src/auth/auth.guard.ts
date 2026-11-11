import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../prisma/db.js';

/** How often a user's lastActiveAt is written (presence granularity). */
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;
const lastWrite = new Map<number, number>();

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization token is required');
    }

    const [type, token] = String(authHeader).split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    let payload: { sub: number; ver?: number; purpose?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Short-lived 2FA challenge tokens are not sessions.
    if (payload.purpose) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await db.orm.public.User.where({ id: Number(payload.sub) })
      .select('id', 'tokenVersion')
      .first();

    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    // "Log out of all devices" / password changes bump tokenVersion.
    if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    request.user = payload;
    this.touchActivity(user.id);
    return true;
  }

  private touchActivity(userId: number) {
    const now = Date.now();
    if (now - (lastWrite.get(userId) ?? 0) < ACTIVITY_WRITE_INTERVAL_MS) return;
    lastWrite.set(userId, now);
    db.orm.public.User.where({ id: userId })
      .update({ lastActiveAt: new Date(now).toISOString() })
      .catch(() => lastWrite.delete(userId));
  }
}
