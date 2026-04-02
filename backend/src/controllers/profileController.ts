
import { Request, Response } from 'express';

export class ProfileController {
  public static async get(req: Request, res: Response) {
    res.json({
      status: 'success',
      data: {
        id: 'USR-4829',
        name: 'Mumbai Citizen',
        email: 'citizen-4829@flowcity.in',
        role: 'user',
        preferences: { mode: 'Train', avoidHighCrowd: true, maxWalkDist: 1 },
        trustScore: 94
      }
    });
  }

  public static async update(req: Request, res: Response) {
    res.json({
      status: 'success',
      message: 'Profile and preferences updated.',
      data: req.body
    });
  }

  public static async getJourneys(req: Request, res: Response) {
    const history = [
      { id: 'J-1', from: 'Bandra', to: 'Worli', date: '2026-04-03', trustScore: 92 },
      { id: 'J-2', from: 'Andheri', to: 'BKC', date: '2026-04-02', trustScore: 88 }
    ];
    res.json({ status: 'success', data: { history } });
  }

  public static async getStats(req: Request, res: Response) {
    res.json({
      status: 'success',
      data: {
        totalJourneys: 42,
        timeSaved: 120, // minutes
        trustScoreAvg: 90,
        badges: ['Early Bird', 'Eco Warrior', 'Safety Shield']
      }
    });
  }
}
