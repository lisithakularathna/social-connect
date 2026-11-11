import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../prisma/db.js';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp.js';

const DEFAULT_GOOGLE_CLIENT_ID =
  '991770544980-h1jr6bpuq3t064mjk80u6kkd3af14nee.apps.googleusercontent.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const RECOVERY_CODE_COUNT = 8;

/** Escape LIKE wildcards so ilike() behaves as a case-insensitive equals. */
const likeExact = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

type AuthUser = {
  id: number;
  email: string;
  username: string | null;
  name: string | null;
  profileImageUrl?: string | null;
  tokenVersion?: number | null;
  twoFactorEnabled?: boolean | null;
};

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(private readonly jwtService: JwtService) {}

  private get googleClientId() {
    return process.env['GOOGLE_CLIENT_ID'] || DEFAULT_GOOGLE_CLIENT_ID;
  }

  private getGoogleClient(): OAuth2Client {
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(this.googleClientId);
    }
    return this.googleClient;
  }

  private async issueSession(user: AuthUser, message: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      username: user.username,
      ver: user.tokenVersion ?? 0,
    });

    return {
      message,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        profileImageUrl: user.profileImageUrl ?? null,
      },
    };
  }

  /**
   * Either a full session, or — when 2FA is on — a short-lived challenge the
   * client exchanges (with a 6-digit code) at POST /auth/2fa/verify.
   */
  private async sessionOrChallenge(user: AuthUser, message: string) {
    if (user.twoFactorEnabled) {
      const challengeToken = await this.jwtService.signAsync(
        { sub: user.id, purpose: '2fa' },
        { expiresIn: '5m' },
      );
      return {
        message: 'Two-factor authentication required',
        twoFactorRequired: true,
        challengeToken,
      };
    }
    return this.issueSession(user, message);
  }

  private async findUser(id: number) {
    const user = await db.orm.public.User.where({ id }).first();
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async register(
    rawEmail: string,
    rawUsername: string,
    password: string,
    rawName?: string,
  ) {
    const email = String(rawEmail ?? '').trim().toLowerCase();
    const username = String(rawUsername ?? '').trim();
    const name = rawName ? String(rawName).trim() : undefined;

    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException('Please enter a valid email address');
    }
    if (!USERNAME_RE.test(username)) {
      throw new BadRequestException(
        'Username must be 3-30 characters: letters, numbers, "_" or "."',
      );
    }
    if (typeof password !== 'string' || password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const [emailTaken, usernameTaken] = await Promise.all([
      db.orm.public.User.where({ email }).first(),
      db.orm.public.User.where((u) =>
        u.username.ilike(likeExact(username)),
      ).first(),
    ]);

    if (emailTaken) {
      throw new ConflictException('Email already registered');
    }
    if (usernameTaken) {
      throw new ConflictException('Username is already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.orm.public.User.create({
      email,
      username,
      name: name || username,
      password: hashedPassword,
    });

    // Returning a token lets clients sign the user straight in after signup.
    return this.issueSession(user, 'User registered successfully');
  }

  async login(rawEmail: string, password: string) {
    const email = String(rawEmail ?? '').trim().toLowerCase();

    if (!email || !password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Older accounts may have been stored with mixed-case emails.
    const user =
      (await db.orm.public.User.where({ email }).first()) ??
      (await db.orm.public.User.where((u) =>
        u.email.ilike(likeExact(email)),
      ).first());

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.sessionOrChallenge(user, 'Login successful');
  }

  /** Second login step: exchange the challenge + TOTP/recovery code. */
  async verifyTwoFactorLogin(challengeToken: string, code: string) {
    let payload: { sub: number; purpose?: string };
    try {
      payload = await this.jwtService.verifyAsync(challengeToken);
    } catch {
      throw new UnauthorizedException(
        'Your sign-in attempt expired. Please log in again.',
      );
    }
    if (payload.purpose !== '2fa') {
      throw new UnauthorizedException('Invalid sign-in attempt');
    }

    const user = await this.findUser(Number(payload.sub));
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return this.issueSession(user, 'Login successful');
    }

    const ok = await this.checkSecondFactor(user, code);
    if (!ok) {
      throw new UnauthorizedException('Incorrect code. Try again.');
    }
    return this.issueSession(user, 'Login successful');
  }

  /** Accepts a TOTP code, or consumes a one-time recovery code. */
  private async checkSecondFactor(
    user: { id: number; twoFactorSecret: string | null; twoFactorRecovery: string | null },
    rawCode: string,
  ) {
    const code = String(rawCode ?? '').trim();
    if (user.twoFactorSecret && verifyTotp(user.twoFactorSecret, code)) {
      return true;
    }

    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length !== 10 || !user.twoFactorRecovery) return false;

    let hashes: string[] = [];
    try {
      hashes = JSON.parse(user.twoFactorRecovery);
    } catch {
      return false;
    }
    const hash = sha256(normalized);
    if (!hashes.includes(hash)) return false;

    await db.orm.public.User.where({ id: user.id }).update({
      twoFactorRecovery: JSON.stringify(hashes.filter((h) => h !== hash)),
    });
    return true;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters',
      );
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }

    const user = await this.findUser(userId);

    const valid = await bcrypt.compare(currentPassword, user.password);
    // 400, not 401: a typo here must not log the user out on the clients.
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const password = await bcrypt.hash(newPassword, 10);
    const tokenVersion = (user.tokenVersion ?? 0) + 1;
    // Bumping tokenVersion signs out every other device.
    const updated = await db.orm.public.User.where({ id: userId }).update({
      password,
      tokenVersion,
    });

    const session = await this.issueSession(
      { ...user, ...updated, tokenVersion },
      'Password changed successfully',
    );
    return session;
  }

  /** Invalidate every session, then hand this device a fresh token. */
  async logoutAllDevices(userId: number) {
    const user = await this.findUser(userId);
    const tokenVersion = (user.tokenVersion ?? 0) + 1;
    await db.orm.public.User.where({ id: userId }).update({ tokenVersion });
    return this.issueSession(
      { ...user, tokenVersion },
      'Signed out of all other devices',
    );
  }

  async changeEmail(userId: number, rawEmail: string, password: string) {
    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException('Please enter a valid email address');
    }

    const user = await this.findUser(userId);
    if (!password || !(await bcrypt.compare(password, user.password))) {
      throw new BadRequestException('Password is incorrect');
    }
    if (email === user.email.toLowerCase()) {
      throw new BadRequestException('That is already your email address');
    }

    const taken = await db.orm.public.User.where((u) =>
      u.email.ilike(likeExact(email)),
    ).first();
    if (taken && taken.id !== userId) {
      throw new ConflictException('Email already registered');
    }

    await db.orm.public.User.where({ id: userId }).update({ email });
    return { message: 'Email updated', email };
  }

  // ── Two-factor authentication ─────────────────────────────

  async twoFactorStatus(userId: number) {
    const user = await this.findUser(userId);
    let remaining = 0;
    try {
      remaining = JSON.parse(user.twoFactorRecovery ?? '[]').length;
    } catch {
      remaining = 0;
    }
    return {
      enabled: Boolean(user.twoFactorEnabled),
      recoveryCodesRemaining: user.twoFactorEnabled ? remaining : 0,
    };
  }

  /** Step 1: create a pending secret the user adds to their authenticator. */
  async setupTwoFactor(userId: number) {
    const user = await this.findUser(userId);
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already on');
    }
    const secret = generateTotpSecret();
    await db.orm.public.User.where({ id: userId }).update({
      twoFactorSecret: secret,
    });
    return {
      secret,
      otpauthUrl: otpauthUrl(secret, user.email),
    };
  }

  /** Step 2: confirm a code from the app, switch 2FA on, issue recovery codes. */
  async enableTwoFactor(userId: number, code: string) {
    const user = await this.findUser(userId);
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already on');
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Start the setup first');
    }
    if (!verifyTotp(user.twoFactorSecret, code)) {
      throw new BadRequestException(
        "That code didn't match. Check your authenticator app and try again.",
      );
    }

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );
    await db.orm.public.User.where({ id: userId }).update({
      twoFactorEnabled: true,
      twoFactorRecovery: JSON.stringify(recoveryCodes.map(sha256)),
    });

    return {
      message: 'Two-factor authentication is on',
      // Shown once, formatted XXXXX-XXXXX for readability.
      recoveryCodes: recoveryCodes.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`),
    };
  }

  async disableTwoFactor(userId: number, password: string, code: string) {
    const user = await this.findUser(userId);
    if (!user.twoFactorEnabled) {
      return { message: 'Two-factor authentication is already off' };
    }
    if (!password || !(await bcrypt.compare(password, user.password))) {
      throw new BadRequestException('Password is incorrect');
    }
    if (!(await this.checkSecondFactor(user, code))) {
      throw new BadRequestException('Incorrect authentication code');
    }
    await db.orm.public.User.where({ id: userId }).update({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecovery: null,
    });
    return { message: 'Two-factor authentication is off' };
  }

  async googleLogin(idToken: string) {
    if (!idToken) {
      throw new UnauthorizedException('Missing Google token');
    }

    let ticket;
    try {
      ticket = await this.getGoogleClient().verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
    } catch (err) {
      console.error('Google token verification error:', err);
      throw new UnauthorizedException('Invalid Google token');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Google token payload invalid');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const email = payload.email.toLowerCase();
    let user = await db.orm.public.User.where({ email }).first();

    if (!user) {
      const base =
        email
          .split('@')[0]
          .replace(/[^a-zA-Z0-9_]/g, '')
          .slice(0, 20) || 'user';
      const username = `${base}_${randomBytes(3).toString('hex')}`;

      // Google-created accounts get an unguessable random password, so the
      // only way in is Google sign-in (previously it was derived from the
      // Google user id, which anyone who knew that id could reproduce).
      const randomPassword = randomBytes(32).toString('hex');

      user = await db.orm.public.User.create({
        email,
        username,
        name: payload.name ?? username,
        profileImageUrl: payload.picture ?? undefined,
        password: await bcrypt.hash(randomPassword, 10),
      });
    }

    return this.sessionOrChallenge(user, 'Google login successful');
  }
}
