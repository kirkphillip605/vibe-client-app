import { PrismaClient } from '@prisma/client';

// Create a single PrismaClient instance
export const prisma = new PrismaClient();

// Auth middleware – extracts JWT from Authorization header
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: 'dj' };
  clientEvent?: { id: string; code: string; role: 'client' };
}

/**
 * Middleware that validates the JWT token and populates req.user or req.clientEvent.
 * If the token is missing or invalid, a 401 response is sent.
 */
export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    if (payload.role === 'client') {
      req.clientEvent = {
        id: payload.eventId,
        code: payload.code,
        role: 'client',
      };
    } else {
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: 'dj',
      };
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

