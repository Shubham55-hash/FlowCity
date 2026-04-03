import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

export type Role = 'user' | 'admin' | 'premium';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  trustScore: number;
}

export interface JWTPayload extends JwtPayload {
  id: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export interface AppErrorArgs {
  name?: string;
  statusCode: number;
  message: string;
  isOperational?: boolean;
}
