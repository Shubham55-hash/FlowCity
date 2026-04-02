import { Request, Response } from 'express';
import { ghostCommuteService, SimulateJourneyInput } from '../services/ghostCommuteService';
import { rescueService } from '../services/rescueService';
import { geocoderService } from '../services/geocoderService';

class GhostCommuteController {
  /**
   * Performs a full journey simulation with multi-leg support
   */
  public async simulate(req: Request, res: Response) {
    try {
      const input: SimulateJourneyInput = req.body;
      const { startLocation, endLocation, preferences } = input;
      const departureTime = input.departureTime ? new Date(input.departureTime) : new Date();

      // Ensure coordinates exist; if not, use geocoderService
      if ((!startLocation.lat || startLocation.lat === 0) && startLocation.name) {
        const coords = await geocoderService.geocode(startLocation.name);
        if (coords) {
          startLocation.lat = coords.lat;
          startLocation.lng = coords.lng;
        }
      }

      if ((!endLocation.lat || endLocation.lat === 0) && endLocation.name) {
        const coords = await geocoderService.geocode(endLocation.name);
        if (coords) {
          endLocation.lat = coords.lat;
          endLocation.lng = coords.lng;
        }
      }

      const result = await ghostCommuteService.simulateJourney(
        startLocation,
        endLocation,
        departureTime,
        preferences
      );

      // Automatic Rescue Mode Attachment
      const journeyId = `JRN-${Date.now()}`;
      rescueService.monitorJourney(journeyId, 'citizen-demo', result);

      res.status(200).json({
        ...result,
        journeyId,
      });
    } catch (error) {
      console.error('Ghost Commute Simulation Error:', error);
      res.status(500).json({ error: 'Failed to simulate journey' });
    }
  }

  /**
   * Quick simulation for lightweight UI previews
   */
  public async getQuickSimulation(req: Request, res: Response) {
    try {
      const q = req.query;
      const startLocation = { name: q.from as string, lat: 0, lng: 0 };
      const endLocation = { name: q.to as string, lat: 0, lng: 0 };
      const departureTime = new Date();
      const preferences = {
        priority: (q.priority as any) || 'time',
        avoidCrowds: q.avoidCrowds === 'true',
      };

      const result = await ghostCommuteService.simulateJourney(startLocation, endLocation, departureTime, preferences);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Ghost Commute Quick Simulation Error:', error);
      res.status(500).json({ error: 'Failed to simulate journey' });
    }
  }

  public getCacheStats(req: Request, res: Response) {
    res.json({ size: 0, keys: [] });
  }

  public invalidateCache(req: Request, res: Response) {
    res.json({ status: 'OK', key: req.params.routeKey });
  }

  // Debug endpoint to manually trigger a disruption for testing Rescue Mode
  public triggerDisruption(req: Request, res: Response) {
    const { journeyId } = req.body;
    // Special internal method to force a disruption notification
    rescueService.debugTrigger(journeyId); 
    res.json({ message: 'Disruption simulation triggered for journey ' + journeyId });
  }
}

export const ghostCommuteController = new GhostCommuteController();
