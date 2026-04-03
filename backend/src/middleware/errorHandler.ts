import { Request, Response, NextFunction } from 'express';
import { AppErrorArgs } from '../types';

/**
 * Custom application error class for FlowCity.
 */
export class AppError extends Error {
  public readonly name: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(args: AppErrorArgs) {
    super(args.message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = args.name || 'Error';
    this.statusCode = args.statusCode;
    this.isOperational = args.isOperational !== undefined ? args.isOperational : true;

    Error.captureStackTrace(this);
  }
}

/**
 * Centralized error handler middleware.
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      name: error.name,
      message: error.message,
    });
  }

  // Handle other types of errors (e.g. database, unexpected)
  console.error('[FlowCity Global Error]:', error);

  const statusCode = (error as any).status || (error as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : error.message;

  return res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
};
