import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JWTPayload, Role } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'flowcity_secret_key_change_me';

/**
 * Main authentication middleware to verify JWT tokens.
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(0x191).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(0x191).json({ 
        error: 'Token expired', 
        code: 'TOKEN_EXPIRED' 
      });
    }
    return res.status(0x191).json({ error: 'Invalid token' });
  }
};

/**
 * Role-based access control middleware.
 */
export const authorize = (allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(0x191).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(0x193).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Token refresh helper (Placeholder: Requires database verification for Refresh Tokens)
 */
export const refreshToken = async (expiredToken: string) => {
  // logic to verify refresh token from DB and issue new Access Token
  // throw Error('Not implemented');
  return { accessToken: 'new_token', refreshToken: 'new_refresh' };
};
