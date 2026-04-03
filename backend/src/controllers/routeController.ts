
import { Request, Response } from 'express';
import { geocoderService } from '../services/geocoderService';

export class RouteController {
  public static async getAll(req: Request, res: Response) {
    const routes = [
      { id: 'R1', name: 'Bandra-Worli Sea Link', mode: 'Road', length: 5.6 },
      { id: 'R2', name: 'Western Line', mode: 'Train', length: 60.0 },
      { id: 'R3', name: 'Metro Line 1', mode: 'Metro', length: 11.4 }
    ];
    res.json({ status: 'success', data: { routes } });
  }

  public static async getNearby(req: Request, res: Response) {
    const { lat, lng, radius } = req.query;
    res.json({
      status: 'success',
      data: {
        radius,
        nearby: [
          { id: 'S1', name: 'Andheri West Station', lat: 19.1197, lng: 72.8468, dist: 0.5 },
          { id: 'B1', name: 'Bandra Terminus', lat: 19.0522, lng: 72.8414, dist: 1.2 }
        ]
      }
    });
  }

  public static async getSpecific(req: Request, res: Response) {
    const { from, to } = req.params;
    res.json({
      status: 'success',
      data: {
        from, to,
        routes: [
           { id: 'R101', name: 'Express Train', duration: 32, cost: 20 },
           { id: 'R202', name: 'Main Road', duration: 45, cost: 150 }
        ]
      }
    });
  }

  public static async autocomplete(req: Request, res: Response) {
    try {
      const query = (req.query.q as string || '').trim();
      if (!query) {
        return res.json({ status: 'success', data: { suggestions: [] } });
      }

      const suggestions = await geocoderService.autocomplete(query, 8);
      return res.json({ status: 'success', data: { suggestions } });
    } catch (error) {
      console.error('Autocomplete API error:', error);
      return res.status(500).json({ status: 'error', message: 'Autocomplete failed' });
    }
  }
}
