import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db/index';

const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET || JWT_SECRET === 'your_super_secret_jwt_key_here') {
  throw new Error('JWT_SECRET env var is not set!');
}

export class AuthController {
  public static async signup(req: Request, res: Response) {
    const { email, password, city } = req.body;

    try {
      // Check if user already exists
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ status: 'fail', message: 'Email already registered' });
      }

      // Hash password
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      const name = email.split('@')[0];

      const result = await pool.query(
        `INSERT INTO users (email, name, city, auth_tokens)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [email, name, city, JSON.stringify({ passwordHash })]
      );

      const userId = result.rows[0].id;
      const token = jwt.sign({ id: userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        status: 'success',
        message: 'Account created successfully',
        data: { token, user: { id: userId, email, city } }
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  }

  public static async login(req: Request, res: Response) {
    const { email, password } = req.body;

    try {
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      const result = await pool.query(
        `SELECT id, name, email FROM users 
         WHERE email = $1 AND auth_tokens->>'passwordHash' = $2`,
        [email, passwordHash]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ status: 'fail', message: 'Invalid email or password' });
      }

      const user = result.rows[0];
      const token = jwt.sign({ id: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        status: 'success',
        data: { token, user: { id: user.id, email: user.email, name: user.name, role: 'user' } }
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  }

  public static async refresh(req: Request, res: Response) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token required' });
    }
    try {
      const old = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
      const newToken = jwt.sign({ id: old.id, role: old.role }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ status: 'success', data: { token: newToken } });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  public static async logout(req: Request, res: Response) {
    res.json({ status: 'success', message: 'Logged out' });
  }
}