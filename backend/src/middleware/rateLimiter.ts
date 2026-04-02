import { RateLimitRequestHandler, rateLimit } from 'express-rate-limit';
import { AuthRequest } from '../types';

/**
 * Configure rate limiter with tiered quotas.
 * Users are limited to 100 req/min by default.
 * Premium users are allowed 1000 req/min.
 */
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: any) => {
    // If the request has been authenticated already, use user roles
    const authReq = req as AuthRequest;
    if (authReq.user?.role === 'premium' || authReq.user?.role === 'admin') {
      return 1000;
    }
    return 100;
  },
  keyGenerator: (req) => {
    // Falls back to IP if user ID is missing
    return (req as AuthRequest).user?.id || req.ip || 'global';
  },
  message: {
    status: 429,
    error: 'Too many requests. Please try again after 1 minute.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Higher restriction limiter for sensitive routes like auth.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    status: 429,
    error: 'Too many failed login attempts. Please try again after 15 minutes.',
  },
});
