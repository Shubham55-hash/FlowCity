
import { Request, Response } from 'express';
import commuteReplayService from '../services/commuteReplayService';
import { AuthRequest } from '../types';

class CommuteReplayController {
  /**
   * Retrieves the comprehensive journey replay for a specific ID.
   */
  async getReplay(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const replay = await commuteReplayService.journeyReplay(id);
      res.json(replay);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  /**
   * Retrieves high-level stats and trends for the authenticated user.
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id || 'demo-user'; // Fallback to demo for UX
      const insights = await commuteReplayService.extractInsights(userId);
      res.json(insights);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Retrieves personalized recommendations for the authenticated user.
   */
  async getRecommendations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id || 'demo-user';
      const recommendations = await commuteReplayService.recommendations(userId);
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new CommuteReplayController();
