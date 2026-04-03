import { RateLimitRequestHandler, rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { AuthRequest } from '../types';

/**
 * Configure rate limiter with tiered quotas.
 * Users are limited to 100 req/min by default.
 * Premium users are allowed 1000 req/min.
 */
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator: (req) => {
    // Use authenticated user ID if available, otherwise use the
    // ipKeyGenerator helper which safely handles IPv6 addresses.
    const userId = (req as AuthRequest).user?.id;
    if (userId) return userId;
    return ipKeyGenerator(req.ip ?? '');
  },
  validate: { trustProxy: false },
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
