import { Request, Response, NextFunction } from 'express';
import { z, AnyZodObject } from 'zod';

/**
 * Generic validation middleware wrapping Zod schemas.
 */
export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validates body, query, and params
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Assign parsed data back to request to ensure type safety and sanitization
      Object.assign(req, parsed);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(0x190).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};

/**
 * Common validation schemas for reuse across FlowCity
 */
export const schemas = {
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  journeyRequest: z.object({
    body: z.object({
      origin: z.string().min(1),
      destination: z.string().min(1),
      departureTime: z.string().datetime(),
      preferences: z.array(z.string()).optional(),
    }),
  }),
};
