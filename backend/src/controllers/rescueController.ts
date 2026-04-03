import { Request, Response } from 'express';
import { geocoderService } from '../services/geocoderService';
import { rescueService } from '../services/rescueService';
import type { SimulationResult } from '../services/ghostCommuteService';

export class RescueController {
  /**
   * POST /api/rescue/alternatives
   * Real multi-priority reroutes for the Rescue Shield (no JWT — demo/local use).
   */
  public static async getAlternatives(req: Request, res: Response) {
    try {
      const { from, to, time, journeyId } = req.body as {
        from?: string;
        to?: string;
        time?: string;
        journeyId?: string;
      };

      if (!from?.trim() || !to?.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'from and to are required',
        });
      }

      const fromCoords = await geocoderService.geocode(from.trim());
      const toCoords = await geocoderService.geocode(to.trim());

      if (!fromCoords || !toCoords) {
        return res.status(400).json({
          status: 'error',
          message: 'Could not resolve one or both locations',
        });
      }

      const departureTime = time ? new Date(time) : new Date();
      const start = { name: from.trim(), lat: fromCoords.lat, lng: fromCoords.lng };
      const end = { name: to.trim(), lat: toCoords.lat, lng: toCoords.lng };

      const alternatives = await rescueService.previewShieldRoutes(start, end, departureTime);

      res.json({
        status: 'success',
        data: {
          journeyId: journeyId || null,
          monitoring: journeyId ? rescueService.isMonitoring(journeyId) : false,
          alternatives,
        },
      });
    } catch (err: unknown) {
      console.error('Rescue getAlternatives:', err);
      res.status(500).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to compute alternatives',
      });
    }
  }

  public static async switchRoute(req: Request, res: Response) {
    try {
      const { journeyId, optionId, simulation } = req.body as {
        journeyId?: string;
        optionId?: string;
        simulation?: SimulationResult;
      };

      if (journeyId && optionId) {
        rescueService.onUserChoice(journeyId, optionId);
      }

      res.json({
        status: 'success',
        message: 'Route update acknowledged',
        data: { optionId, simulation: simulation ?? null },
      });
    } catch (err: unknown) {
      console.error('Rescue switchRoute:', err);
      res.status(500).json({ status: 'error', message: 'Switch failed' });
    }
  }

  /** Development: push RES_MODE_ALERT to clients in journey_<journeyId> */
  public static async triggerTest(req: Request, res: Response) {
    try {
      const journeyId = (req.body as { journeyId?: string }).journeyId;
      if (!journeyId?.trim()) {
        return res.status(400).json({ status: 'error', message: 'journeyId is required' });
      }
      const ok = rescueService.debugTrigger(journeyId.trim());
      if (!ok) {
        return res.status(404).json({
          status: 'error',
          message:
            'Journey not monitored. Plan a trip first so the server registers your journey id, then try again.',
        });
      }
      res.json({
        status: 'success',
        message: 'Disruption test emitted to socket room (Ghost Commute / clients must join this journey id).',
      });
    } catch (err: unknown) {
      console.error('Rescue triggerTest:', err);
      res.status(500).json({ status: 'error', message: 'Trigger failed' });
    }
  }
}
