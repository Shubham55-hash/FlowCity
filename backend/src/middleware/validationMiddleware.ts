
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// ── Validation Schemas ───────────────────────────────────────────────────────

export const schemas = {
  auth: {
    signup: z.object({
      email: z.string().email(),
      password: z.string().min(8),
      city: z.string().min(2)
    }),
    login: z.object({
      email: z.string().email(),
      password: z.string()
    })
  },
  journey: {
    plan: z.object({
      from: z.string().min(2),
      to: z.string().min(2),
      time: z.string().optional(),
      preferences: z.object({
        priority: z.enum(['time', 'cost', 'safety']).optional(),
        avoidCrowds: z.boolean().optional()
      }).optional()
    })
  },
  wallet: {
    topup: z.object({
      amount: z.number().positive()
    })
  },
  safety: {
    report: z.object({
      lat: z.number(),
      lng: z.number(),
      type: z.string(),
      severity: z.enum(['low', 'medium', 'high'])
    })
  }
};

// ── Middleware Generator ────────────────────────────────────────────────────

export const validate = (schema: z.ZodObject<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err: any) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: err.errors
      });
    }
  };
};
