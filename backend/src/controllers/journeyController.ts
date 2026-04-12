
import { Request, Response } from 'express';
import { geocoderService } from '../services/geocoderService';
import { ghostCommuteService } from '../services/ghostCommuteService';
import { rescueService } from '../services/rescueService';
import { verifyRouteData } from '../services/priceVerifier';


/**
 * Extract a short, clean station/area name from a long Nominatim display_name.
 * E.g. "Dhan, Sunder Wadi, K/W Ward, Mumbai Zone 3, Mumbai..." → "Dhan"
 *      "Virar - Dahanu Road Quadrupling, Mumbai"               → "Virar"
 *      "Borivali, Maharashtra, India"                          → "Borivali"
 */
function cleanLocationName(raw: string): string {
  const first = raw.split(/\s*[,-]\s*/)[0].trim();
  // If token is too short (e.g. "K"), grab first two comma-parts
  if (first.length < 3) {
    const parts = raw.split(/\s*,\s*/);
    return parts.slice(0, 2).join(', ').trim();
  }
  return first;
}

export class JourneyController {
  public static async plan(req: Request, res: Response) {
    try {
      const { from, to, preferences } = req.body;
      const departureTime = req.body.time ? new Date(req.body.time) : new Date();

      console.log(`Plan request: from="${from}", to="${to}"`);

      // 1. Clean raw autocomplete strings → short geocodable names
      const cleanFrom = cleanLocationName(from);
      const cleanTo   = cleanLocationName(to);
      console.log(`Clean names: "${cleanFrom}" → "${cleanTo}"`);

      // 2. Geocode — try clean name first (fast local registry hit), fallback to raw
      const fromCoords = await geocoderService.geocode(cleanFrom)
                      || await geocoderService.geocode(from);
      const toCoords   = await geocoderService.geocode(cleanTo)
                      || await geocoderService.geocode(to);

      console.log(`Geocoded: "${cleanFrom}" →`, fromCoords, `| "${cleanTo}" →`, toCoords);

      if (!fromCoords || !toCoords) {
        return res.status(400).json({
          status: 'fail',
          message: `Could not resolve location: ${!fromCoords ? `"${cleanFrom}"` : `"${cleanTo}"`}. Please pick a location within Mumbai.`,
        });
      }

      // 3. Run Ghost Commute simulation
      const simulation = await ghostCommuteService.simulateJourney(
        { name: cleanFrom, lat: fromCoords.lat, lng: fromCoords.lng },
        { name: cleanTo,   lat: toCoords.lat,   lng: toCoords.lng },
        departureTime,
        {
          priority: preferences?.priority?.toLowerCase() || 'safety',
          avoidCrowds: preferences?.avoidCrowds || false,
        }
      );

      // 4. Register journey for Rescue Shield
      const journeyId = `JRN-${Date.now()}`;
      rescueService.monitorJourney(journeyId, 'citizen-demo', simulation);

      // 5. Generate dynamic risk factors
      const riskLevel = simulation.overallRisk || 'Low';
      const trust = simulation.overallSafetyScore || 100;
      const tStations = simulation.segments
        .filter((s: any) => s.type === 'local_train' || s.type === 'metro')
        .map((s: any) => (s.from || '').replace(/\s+station/i, '').trim());
      const stnStr = tStations.length > 0 ? tStations.join(', ') : 'this route';

      let riskFactors = '';
      if (riskLevel === 'Low') {
        riskFactors = trust >= 90 ? `Optimal conditions across ${stnStr}. No major crowding expected.` : `Clear route. Minor baseline congestion typical around ${stnStr}.`;
      } else if (riskLevel === 'Medium') {
        riskFactors = `Moderate crowding expected near ${tStations[0] || 'your interchanges'}. Allow a 5-10 minute buffer for possible boarding delays.`;
      } else {
        const pStn = tStations.length > 0 ? tStations[tStations.length - 1] : cleanFrom;
        riskFactors = `Heavy congestion expected near ${pStn}. Platform density is high and significant delays are likely.`;
      }

      // 6. Respond — use cleanFrom/cleanTo so the frontend stores re-geocodable names
      const dominantMode =
        simulation.segments.find((s: any) => s.type !== 'walk' && s.type !== 'Wait')?.type
        || simulation.segments[0]?.type
        || 'local_train';

      return res.status(201).json({
        status: 'success',
        data: {
          id: journeyId,
          mode: dominantMode,
          from: cleanFrom,
          to: cleanTo,
          trustScore: simulation.overallSafetyScore,
          status:
            simulation.overallRisk === 'Low' ? 'Safe'
            : simulation.overallRisk === 'Medium' ? 'Moderate'
            : 'Risky',
          eta: simulation.totalTimeMin,
          cost: Math.round(simulation.totalPredictedCost),
          riskFactors,
          alternatives: simulation.alternatives.map((alt: any) => ({
            id: alt.id,
            mode: alt.label,
            label: alt.label,
            eta: alt.totalTimeMin,
            trustScore: alt.safetyScore,
            predictedCost: Math.round(alt.predictedCost),
          })),
          simulationDetails: simulation,
        },
      });
    } catch (error: any) {
      console.error('Journey Planning Error:', error);
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  public static async getActive(req: Request, res: Response) {
    return res.json({
      status: 'success',
      data: {
        id: req.params.id,
        currentLocation: { lat: 19.0760, lng: 72.8777 },
        progress: 65,
        remainingTime: 12,
        isDelayed: false,
      },
    });
  }

  public static async updateStatus(req: Request, res: Response) {
    return res.json({ status: 'success', message: 'Real-time status updated', data: req.body });
  }

  /** POST /api/journey/verify-fares
   *  Body: { fromLat, fromLng, toLat, toLng, departureTime? }
   *  Returns cross-checked distances and official fare ranges for all modes.
   */
  public static async verifyFares(req: Request, res: Response) {
    try {
      const { fromLat, fromLng, toLat, toLng, departureTime } = req.body;
      if ([fromLat, fromLng, toLat, toLng].some(v => typeof v !== 'number')) {
        return res.status(400).json({ status: 'fail', message: 'fromLat, fromLng, toLat, toLng must be numbers' });
      }
      const result = await verifyRouteData({
        fromLat: Number(fromLat), fromLng: Number(fromLng),
        toLat: Number(toLat),     toLng: Number(toLng),
        departureTimeIso: departureTime || new Date().toISOString(),
      });
      return res.json({ status: 'success', data: result });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }
}
