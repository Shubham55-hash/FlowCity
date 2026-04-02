
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'flowcity_secret_key_change_me';

export class AuthController {
  public static async signup(req: Request, res: Response) {
    const { email, password, city } = req.body;
    
    // MOCK: Save user to DB logic
    const userId = `USR-${Math.floor(Math.random() * 10000)}`;
    const token = jwt.sign({ id: userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully',
      data: { token, user: { id: userId, email, city } }
    });
  }

  public static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    
    // MOCK: Verify credentials logic
    const userId = 'USR-4829';
    const token = jwt.sign({ id: userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      status: 'success',
      data: { token, user: { id: userId, email, name: 'Mumbai Citizen', role: 'user' } }
    });
  }

  public static async refresh(req: Request, res: Response) {
    const userId = 'USR-4829';
    const newToken = jwt.sign({ id: userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ status: 'success', data: { token: newToken } });
  }

  public static async logout(req: Request, res: Response) {
    res.json({ status: 'success', message: 'Logged out from all sessions' });
  }
}
