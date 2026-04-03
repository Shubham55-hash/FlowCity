import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validateRequest = (schema: z.ZodObject<any, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(500).json({ error: 'Internal Server Error during validation' });
    }
  };
};

// ── Ghost Commute Specific Schemas ──────────────────────────────────────────

export const ghostCommuteSchema = z.object({
  body: z.object({
    startLocation: z.object({
      name: z.string().min(1),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }),
    endLocation: z.object({
      name: z.string().min(1),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }),
    departureTime: z.string().datetime().optional(),
    preferences: z.object({
      priority: z.enum(['cost', 'safety', 'time']).default('time'),
      avoidCrowds: z.boolean().optional(),
      maxWalkMinutes: z.number().optional(),
    }).optional(),
  }),
});

export const ghostCommuteQuerySchema = z.object({
  query: z.object({
    start: z.string().optional(),
    startLat: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    startLng: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    end: z.string().optional(),
    endLat: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    endLng: z.string().regex(/^-?\d+(\.\d+)?$/).optional(),
    departureTime: z.string().datetime().optional(),
    priority: z.enum(['cost', 'safety', 'time']).optional(),
    avoidCrowds: z.enum(['true', 'false']).optional(),
  }),
});
