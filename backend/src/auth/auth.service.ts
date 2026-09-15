import { Injectable, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { db } from '../prisma/db.js';

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
}