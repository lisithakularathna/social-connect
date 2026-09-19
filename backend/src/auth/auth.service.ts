import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../prisma/db.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async register(
    email: string,
    username: string,
    password: string,
    name?: string,
  ) {
    const existingUsers = await db.orm.public.User
      .where({ email })
      .all();

    if (existingUsers.length > 0) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.orm.public.User.create({
      email,
      username,
      name,
      password: hashedPassword,
    });

    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
      },
    };
  }

  async login(email: string, password: string) {
    const users = await db.orm.public.User
      .where({ email })
      .all();

    if (users.length === 0) {
      throw new ConflictException('Invalid email or password');
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordMatch) {
      throw new ConflictException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
      },
    };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword || newPassword.length < 6) throw new ConflictException('New password must be at least 6 characters');
    const users = await db.orm.public.User.where({ id: userId }).all();
    const user = users[0];
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const password = await bcrypt.hash(newPassword, 10);
    await db.orm.public.User.where({ id: userId }).update({ password });
    return { message: 'Password changed successfully' };
  }

  async googleLogin(idToken: string) {
    // Google ID Token verify කිරීම
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new UnauthorizedException('Google token payload invalid');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const { email, name, sub: googleId } = payload;

    // User දැනටමත් තිබෙනවාද check කිරීම
    let users = await db.orm.public.User
      .where({ email })
      .all();

    let user;

    if (users.length === 0) {
      // නව user auto-register කිරීම
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') +
        '_' + Math.random().toString(36).slice(2, 6);

      user = await db.orm.public.User.create({
        email,
        username,
        name: name ?? username,
        password: await bcrypt.hash(googleId + '_google_oauth', 10),
      });
    } else {
      user = users[0];
    }

    const jwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload);

    return {
      message: 'Google login successful',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
      },
    };
  }
}