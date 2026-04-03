
import { Request, Response } from 'express';
import { geocoderService } from '../services/geocoderService';
import { ghostCommuteService } from '../services/ghostCommuteService';
import { rescueService } from '../services/rescueService';

export class JourneyController {
  public static async plan(req: Request, res: Response) {
    try {
      const { from, to, preferences } = req.body;
      const departureTime = req.body.time ? new Date(req.body.time) : new Date();

      console.log(`Plan request: from=${from}, to=${to}`);

      // 1. Resolve Geo-coordinates
      const fromCoords = await geocoderService.geocode(from);
      console.log(`From coords:`, fromCoords);
      const toCoords = await geocoderService.geocode(to);
      console.log(`To coords:`, toCoords);

      if (!fromCoords || !toCoords) {
        return res.status(400).json({
          status: 'fail',
          message: `Could not resolve locations: ${!fromCoords ? from : ''} ${!toCoords ? to : ''}`.trim()
        });
      }

      // 2. Run real-time simulation via Ghost Commute
      const simulation = await ghostCommuteService.simulateJourney(
        { name: from, lat: fromCoords.lat, lng: fromCoords.lng },
        { name: to, lat: toCoords.lat, lng: toCoords.lng },
        departureTime,
        { 
          priority: preferences?.priority?.toLowerCase() || 'safety',
          avoidCrowds: preferences?.avoidCrowds || false
        }
      );

      // 3. Register journey for Rescue Shield (socket room journey_<id> must match client)
      const journeyId = `JRN-${Date.now()}`;
      rescueService.monitorJourney(journeyId, 'citizen-demo', simulation);

      // 4. Map to Journey Response
      res.status(201).json({
        status: 'success',
        data: {
          id: journeyId,
          mode: simulation.segments[0]?.type || 'transit',
          from,
          to,
          trustScore: simulation.overallSafetyScore,
          status: simulation.overallRisk === 'Low' ? 'Safe' : simulation.overallRisk === 'Medium' ? 'Moderate' : 'Risky',
          eta: simulation.totalTimeMin,
          cost: Math.round(simulation.totalPredictedCost),
          alternatives: simulation.alternatives.map(alt => ({
            id: alt.id,
            mode: alt.label,
            eta: alt.totalTimeMin,
            trustScore: alt.safetyScore,
            predictedCost: Math.round(alt.predictedCost)
          })),
          simulationDetails: simulation
        }
      });
    } catch (error: any) {
      console.error('Journey Planning Error:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  public static async getActive(req: Request, res: Response) {
    res.json({
      status: 'success',
      data: {
        id: req.params.id,
        currentLocation: { lat: 19.0760, lng: 72.8777 },
        progress: 65,
        remainingTime: 12,
        isDelayed: false
      }
    });
  }

  public static async updateStatus(req: Request, res: Response) {
    res.json({ status: 'success', message: 'Real-time status updated', data: req.body });
  }
}
