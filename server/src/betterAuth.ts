import { betterAuth as createBetterAuth } from 'better-auth';
import { prisma } from './middleware/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

/**
 * BetterAuth is used only for the DJ admin UI.
 * It stores users in the existing `User` table.
 */
export const betterAuth = createBetterAuth({
  // Secret used to sign BetterAuth cookies/JWTs
  secret: process.env.BETTERAUTH_SECRET || 'change-me',
  // JWT that we also use for our own API auth
  signTokens: async (user: any) => {
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );
    return { token };
  },
  // Prisma adapter – we reuse the same Prisma client
  prisma: {
    client: prisma,
    models: {
      user: {
        tableName: 'User',
        fields: {
          id: 'id',
          email: 'email',
          passwordHash: 'passwordHash',
        },
      },
    },
  },
  // Password hashing
  async hashPassword(password: string) {
    return await bcrypt.hash(password, 10);
  },
  async verifyPassword(hash: string, password: string) {
    return await bcrypt.compare(password, hash);
  },
  // After a successful login we also set the same JWT that the rest of the API expects
  async afterLogin(user: any, req: Request, res: Response) {
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );
    // Set a short‑lived cookie for the UI (optional)
    res.cookie('dj_token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });
    // Also return the token in the response body for the client‑side AuthContext
    return { token };
  },
});
