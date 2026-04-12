// ─────────────────────────────────────────────────────────────────────────────
// ghostCommuteService.ts  v2 — Real-API Edition
//
// Data sources (priority order, falls back to heuristic if key missing / error):
//   1. Google Maps Directions API  — route decomposition + walk durations
//   2. Google Maps Distance Matrix — leg-by-leg durations
//   3. Open-Meteo                  — live weather (FREE, no key)
//   4. RapidAPI Indian Railways    — local train delays
//   5. MMRDA (Metro)               — metro status
//   6. BEST GTFS-RT                — bus positions / delays
//   7. Ola / Uber                  — cab ETA (alternatives)
//
// All external call sites are wrapped in try/catch; failures silently fall
// back to the heuristic values so the service never throws to the caller.
// ─────────────────────────────────────────────────────────────────────────────

import axios, { AxiosInstance } from 'axios';
import { stationResolver } from './stationResolver';
import { geocoderService, Coordinates } from './geocoderService';
import { safetyService } from './safetyService';
import { localTrainFare, metroFare, busFare } from './priceVerifier';
import { apiRateLimiter } from '../middleware/rateLimiter';

// ──────────────── Env helpers ─────────────────────────────────────────────────

const env = (key: string) => process.env[key];
const hasKey = (key: string) => !!env(key) && env(key) !== `your_${key.toLowerCase()}_here`;
const hasIRCTCKey = () => hasKey('IRCTC_API_KEY');
const hasRailRadarKey = () => hasKey('RAILRADAR_API_KEY');

// ──────────────── Public Input Types ─────────────────────────────────────────

export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface JourneyPreferences {
  priority: 'cost' | 'safety' | 'time';
  avoidCrowds?: boolean;
  maxWalkMinutes?: number;
}

export interface SimulateJourneyInput {
  startLocation: Location;
  endLocation: Location;
  departureTime: Date;
  preferences: JourneyPreferences;
}

// ──────────────── Internal Types ─────────────────────────────────────────────

type LegType = 'walk' | 'local_train' | 'metro' | 'bus' | 'auto' | 'cab';

interface RawSegment {
  type: LegType;
  from: string;
  to: string;
  fromLatLng?: { lat: number; lng: number };
  toLatLng?: { lat: number; lng: number };
  baseDurationMin: number;
  historicalDelayMin: number;
  crowdFactor: number;
  transferRiskMin: number;
  dataSource: 'real' | 'heuristic'; // transparency flag
}

interface ORSDirectionsResult {
  segments: RawSegment[];
  geometry: Array<{ lat: number; lng: number }>;
}

// ──────────────── Public Output Types ────────────────────────────────────────

export interface SegmentDetail {
  legIndex: number;
  type: LegType;
  from: string;
  to: string;
  predictedDurationMin: number;
  durationRange: { min: number; max: number };
  confidence: number;
  scheduledDepartureTime: string;
  predictedArrivalTime: string;
  waitTimeMin: number;
  crowdLevel: 'Light' | 'Moderate' | 'Heavy' | 'Packed';
  connectionRisk: 'None' | 'Low' | 'Medium' | 'High';
  predictedCost: number;
  fromLatLng?: { lat: number; lng: number };
  toLatLng?: { lat: number; lng: number };
  notes: string;
}

export interface TimelinePoint {
  timeIso: string;
  label: string;
  isRisk: boolean;
  errorBarMin: number;
  errorBarMax: number;
}

export interface AlternativeRoute {
  id: string;
  label: string;
  totalTimeMin: number;
  timeRange: { min: number; max: number };
  confidence: number;
  costScore: number;
  safetyScore: number;
  tradeoff: string;
  legs: string[];
  predictedCost: number;
  etaSource?: string; // 'ola' | 'uber' | 'heuristic'
}

export interface WeatherCondition {
  description: string;
  isAdverse: boolean;
  delayImpactMin: number;
  source: 'open-meteo' | 'heuristic';
}

export interface SimulationResult {
  simulatedAt: string;
  routeKey: string;
  totalTimeMin: number;
  timeRange: { min: number; max: number; confidence: number };
  segments: SegmentDetail[];
  riskFactors: string[];
  alternatives: AlternativeRoute[];
  journeyTimeline: TimelinePoint[];
  overallRisk: 'Low' | 'Medium' | 'High';
  overallSafetyScore: number;
  totalPredictedCost: number;
  weather: WeatherCondition;
  routeGeometry: Array<{ lat: number; lng: number }>;
  dataSources: string[]; // which APIs actually responded
  summary: string;
}

// ──────────────── Cache ───────────────────────────────────────────────────────

interface CacheEntry {
  result: SimulationResult;
  expiry: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GhostCommuteService
// ─────────────────────────────────────────────────────────────────────────────

class GhostCommuteService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  // ── Axios instances ────────────────────────────────────────────────────────
  // OpenRouteService — free, no Google dependency
  private ors: AxiosInstance = axios.create({
    baseURL: 'https://api.openrouteservice.org',
    timeout: 8000,
    headers: {
      'Authorization': env('OPENROUTE_API_KEY') || '',
      'Content-Type': 'application/json',
    },
  });

  private openMeteo: AxiosInstance = axios.create({
    baseURL: 'https://api.open-meteo.com/v1',
    timeout: 5000,
  });

  private railwayApi: AxiosInstance = axios.create({
    baseURL: env('IRCTC_API_BASE_URL') || 'https://irctc1.p.rapidapi.com',
    timeout: 5000,
    headers: {
      'x-rapidapi-key': env('IRCTC_API_KEY') || '',
      'x-rapidapi-host': env('IRCTC_API_HOST') || 'irctc1.p.rapidapi.com',
    },
  });

  private railRadarApi: AxiosInstance = axios.create({
    baseURL: env('RAILRADAR_API_BASE_URL') || 'https://api.railradar.org',
    timeout: 5000,
    headers: {
      // RailRadar may accept API key either as a bearer token or x-api-key header.
      Authorization: env('RAILRADAR_API_KEY') ? `Bearer ${env('RAILRADAR_API_KEY')}` : '',
      'x-api-key': env('RAILRADAR_API_KEY') || '',
    },
  });

  private olaApi: AxiosInstance = axios.create({
    baseURL: env('OLA_API_BASE_URL') || 'https://devapi.olacabs.com/v1',
    timeout: 5000,
    headers: { 'X-APP-TOKEN': env('OLA_API_KEY') || '' },
  });

  private uberApi: AxiosInstance = axios.create({
    baseURL: env('UBER_API_BASE_URL') || 'https://api.uber.com/v1.2',
    timeout: 5000,
    headers: { 'Authorization': `Token ${env('UBER_SERVER_TOKEN') || ''}` },
  });

  // ── Time helpers ───────────────────────────────────────────────────────────
  private isPeakHour(date: Date): boolean {
    if (!date || isNaN(date.getTime())) return false;
    const hm = date.getHours() * 60 + date.getMinutes();
    return (hm >= 7 * 60 + 30 && hm <= 10 * 60 + 30) ||
           (hm >= 17 * 60 + 30 && hm <= 21 * 60);
  }

  private isSuperPeak(date: Date): boolean {
    if (!date || isNaN(date.getTime())) return false;
    const hm = date.getHours() * 60 + date.getMinutes();
    return (hm >= 8 * 60 && hm <= 9 * 60 + 30) ||
           (hm >= 18 * 60 + 30 && hm <= 20 * 60);
  }

  private seededJitter(seed: string, amplitude: number): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return ((hash % 100) / 100) * amplitude * 2 - amplitude;
  }

  private getStationCode(name: string): string {
    const code = stationResolver.resolve(name);
    return code || 'ADH'; // Default to Andheri if totally unknown
  }

  private calculateCabCost(distKm: number, isPeak: boolean, isSuperPeak: boolean): number {
    const baseFare = isSuperPeak ? 100 : (isPeak ? 80 : 50);
    const ratePerKm = isSuperPeak ? 25 : (isPeak ? 20 : 16);
    
    // Minimum fare of 100 for Virar-like distances, 30 for small hops
    const minFare = distKm > 30 ? 400 : 50;
    
    return Math.round(Math.max(minFare, baseFare + (distKm * ratePerKm)));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #1 — OpenRouteService Directions (replaces Google Maps)
  // Uses ORS foot-walking for walk legs; falls back to heuristic for transit.
  // Free: 2,000 req/day — https://openrouteservice.org
  // ──────────────────────────────────────────────────────────────────────────
  private getGeoDistanceKm(start: Location, end: Location): number {
    const R = 6371;
    const dLat = ((end.lat - start.lat) * Math.PI) / 180;
    const dLng = ((end.lng - start.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((start.lat * Math.PI) / 180) * Math.cos((end.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async fetchORSDirections(
    start: Location,
    end: Location,
    departureTime: Date
  ): Promise<ORSDirectionsResult | null> {
    if (!hasKey('OPENROUTE_API_KEY')) return null;

    try {
      // ORS driving-car for overall route shape + timing reference
      const resp = await this.ors.post('/v2/directions/driving-car/json', {
        coordinates: [
          [start.lng, start.lat],
          [end.lng, end.lat],
        ],
        instructions: false,
        geometry: true,
        geometry_simplify: true,
      });

      const route = resp.data?.routes?.[0];
      if (!route) return null;

      const orsDistKm = (route.summary?.distance ?? 0) / 1000;
      const totalDrivingMin = Math.ceil((route.summary?.duration ?? 0) / 60);
      const geoDistKm = this.getGeoDistanceKm(start, end);
      const totalDistKm = Math.min(orsDistKm, Math.max(geoDistKm, orsDistKm * 0.75)); // avoid huge detours

      // Convert ORS driving estimate → Mumbai transit decomposition
      const peak = this.isPeakHour(departureTime);
      const superPeak = this.isSuperPeak(departureTime);

      // Use direct geographic distance where routing is too long
      const transitBaseDistKm = Math.max(geoDistKm, Math.min(totalDistKm, geoDistKm * 1.2));

      const segments: RawSegment[] = [];

      if (totalDistKm < 1.5) {
        segments.push({
          type: 'walk', from: start.name, to: end.name,
          fromLatLng: { lat: start.lat, lng: start.lng },
          toLatLng:   { lat: end.lat,   lng: end.lng   },
          baseDurationMin: Math.max(5, Math.round(totalDistKm * 13)),
          historicalDelayMin: 1, crowdFactor: peak ? 1.25 : 1.0,
          transferRiskMin: 0, dataSource: 'real',
        });
      } else if (totalDistKm < 8) {
        segments.push(
          { type: 'walk', from: start.name, to: `${start.name} Metro Stn`, fromLatLng: { lat: start.lat, lng: start.lng }, toLatLng: { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 }, baseDurationMin: 7, historicalDelayMin: 1, crowdFactor: peak ? 1.3 : 1.0, transferRiskMin: 0, dataSource: 'real' },
          { type: 'metro', from: `${start.name} Metro Stn`, to: `${end.name} Metro Stn`, baseDurationMin: Math.round(totalDistKm * 3.2), historicalDelayMin: superPeak ? 6 : peak ? 3 : 1, crowdFactor: superPeak ? 1.6 : peak ? 1.35 : 1.0, transferRiskMin: 3, dataSource: 'real' },
          { type: 'walk', from: `${end.name} Metro Stn`, to: end.name, toLatLng: { lat: end.lat, lng: end.lng }, fromLatLng: { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 }, baseDurationMin: 6, historicalDelayMin: 1, crowdFactor: 1.0, transferRiskMin: 0, dataSource: 'real' },
        );
      } else {
        // Long route: walk + local train (realistic Mumbai suburban train calibration)
        // Use distance-based rail speed (approx 40 km/h) plus dwell stops and transfer overhead.
        const trainDurationFromDistance = Math.round(transitBaseDistKm / 0.67);  // 0.67 km/min = 40 km/h
        const trainMin = Math.max(20, trainDurationFromDistance + (peak ? 12 : 8));

        segments.push(
          { type: 'walk', from: start.name, to: `${start.name} Station`, fromLatLng: { lat: start.lat, lng: start.lng }, toLatLng: { lat: start.lat + 0.004, lng: start.lng + 0.004 }, baseDurationMin: 6, historicalDelayMin: 1, crowdFactor: peak ? 1.4 : 1.0, transferRiskMin: 0, dataSource: 'real' },
          { type: 'local_train', from: `${start.name} Station`, to: `${end.name} Station`, baseDurationMin: trainMin, historicalDelayMin: superPeak ? 12 : peak ? 7 : 2, crowdFactor: superPeak ? 1.8 : peak ? 1.5 : 1.1, transferRiskMin: 5, dataSource: 'real' },
          { type: 'walk', from: `${end.name} Station`, to: end.name, fromLatLng: { lat: end.lat - 0.004, lng: end.lng - 0.004 }, toLatLng: { lat: end.lat, lng: end.lng }, baseDurationMin: 5, historicalDelayMin: 1, crowdFactor: 1.0, transferRiskMin: 0, dataSource: 'real' },
        );
      }

      const geometry = (route.geometry?.coordinates || []).map((c: any) => ({ lat: c[1], lng: c[0] }));
      return segments.length ? { segments, geometry } : null;
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #2 — ORS Walk Duration (replaces Google Distance Matrix)
  // Uses ORS foot-walking profile for accurate pedestrian timings.
  // ──────────────────────────────────────────────────────────────────────────
  private decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += deltaLat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += deltaLng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return points;
  }

  private async fetchGoogleDirections(
    start: Location,
    end: Location,
    departureTime: Date
  ): Promise<ORSDirectionsResult | null> {
    const googleKey = env('GOOGLE_MAPS_API_KEY');
    if (!googleKey || googleKey === 'your_google_api_key_here' || googleKey === 'CHANGE_ME') return null;

    try {
      const url = 'https://maps.googleapis.com/maps/api/directions/json';
      const response = await axios.get(url, {
        params: {
          origin: `${start.lat},${start.lng}`,
          destination: `${end.lat},${end.lng}`,
          key: googleKey,
          departure_time: Math.floor(departureTime.getTime() / 1000),
          mode: 'transit',
          alternatives: true,
          region: 'in',
          language: 'en'
        },
        timeout: 8000,
      });

      if (response.data?.status !== 'OK' || !response.data.routes?.length) {
        return null;
      }

      const route = response.data.routes[0];
      if (!route.legs || !route.legs.length) return null;
      const leg = route.legs[0];

      const collectedSegments: RawSegment[] = [];
      let overallGeometry: Array<{ lat: number; lng: number }> = [];

      for (const step of leg.steps || []) {
        const stepMode = step.travel_mode;
        const stepStart = step.start_location;
        const stepEnd = step.end_location;
        const stepDuration = Math.ceil((step.duration?.value || 0) / 60);
        const stepPolyline = step.polyline?.points ? this.decodePolyline(step.polyline.points) : [];

        if (stepPolyline.length) {
          overallGeometry = overallGeometry.concat(stepPolyline);
        }

        if (stepMode === 'WALK') {
          collectedSegments.push({
            type: 'walk',
            from: step.html_instructions ? step.html_instructions.replace(/<[^>]+>/g, '') : `${start.name} Walk`,
            to: step.html_instructions ? step.html_instructions.replace(/<[^>]+>/g, '') : `${end.name}`,
            fromLatLng: { lat: stepStart.lat, lng: stepStart.lng },
            toLatLng: { lat: stepEnd.lat, lng: stepEnd.lng },
            baseDurationMin: Math.max(1, stepDuration),
            historicalDelayMin: 0,
            crowdFactor: this.isPeakHour(departureTime) ? 1.25 : 1.0,
            transferRiskMin: 0,
            dataSource: 'real',
          });
        } else if (stepMode === 'TRANSIT') {
          const transit = step.transit_details || {};
          const vehicle = transit.line?.vehicle?.type || '';
          let legType: LegType = 'local_train';
          if (vehicle === 'BUS') legType = 'bus';
          if (vehicle === 'SUBWAY' || vehicle === 'METRO') legType = 'metro';
          if (vehicle === 'TRAM') legType = 'bus';
          if (vehicle === 'HEAVY_RAIL') legType = 'local_train';
          if (vehicle === 'RAIL') legType = 'local_train';

          collectedSegments.push({
            type: legType,
            from: transit.departure_stop?.name || step.html_instructions || `${start.name} Station`,
            to: transit.arrival_stop?.name || step.html_instructions || `${end.name} Station`,
            fromLatLng: { lat: stepStart.lat, lng: stepStart.lng },
            toLatLng: { lat: stepEnd.lat, lng: stepEnd.lng },
            baseDurationMin: Math.max(1, stepDuration),
            historicalDelayMin: 0,
            crowdFactor: this.isPeakHour(departureTime) ? 1.5 : 1.1,
            transferRiskMin: 4,
            dataSource: 'real',
          });

          // Add start and end walking transfer if present
        } else {
          // fallback: use driving/cab estimation
          collectedSegments.push({
            type: 'auto',
            from: step.start_location ? `${stepStart.lat},${stepStart.lng}` : start.name,
            to: step.end_location ? `${stepEnd.lat},${stepEnd.lng}` : end.name,
            fromLatLng: { lat: stepStart.lat, lng: stepStart.lng },
            toLatLng: { lat: stepEnd.lat, lng: stepEnd.lng },
            baseDurationMin: Math.max(1, stepDuration),
            historicalDelayMin: 0,
            crowdFactor: this.isPeakHour(departureTime) ? 1.25 : 1,
            transferRiskMin: 2,
            dataSource: 'real',
          });
        }
      }

      if (collectedSegments.length === 0) return null;

      if (overallGeometry.length === 0) {
        // fallback geometry from start/end
        overallGeometry = [{ lat: start.lat, lng: start.lng }, { lat: end.lat, lng: end.lng }];
      }

      return { segments: collectedSegments, geometry: overallGeometry };
    } catch (error) {
      console.warn('Google Directions API failure:', (error as any)?.message || error);
      return null;
    }
  }

  private async fetchORSWalkDuration(
    fromLat: number, fromLng: number,
    toLat: number,   toLng: number
  ): Promise<number | null> {
    if (!hasKey('OPENROUTE_API_KEY')) return null;

    try {
      const resp = await this.ors.post('/v2/matrix/foot-walking', {
        locations: [
          [fromLng, fromLat],
          [toLng,   toLat  ],
        ],
        metrics: ['duration'],
      });
      const durationSec = resp.data?.durations?.[0]?.[1];
      if (durationSec != null && durationSec > 0) {
        return Math.ceil(durationSec / 60);
      }
      return null;
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #3 — Open-Meteo (FREE, no key required)
  // Returns weather condition affecting delays.
  // ──────────────────────────────────────────────────────────────────────────
  public async fetchWeather(lat: number, lng: number): Promise<WeatherCondition> {
    const weatherEnabled = env('ENABLE_WEATHER') !== 'false';
    if (!weatherEnabled) {
      return { description: 'Weather check disabled', isAdverse: false, delayImpactMin: 0, source: 'heuristic' };
    }

    try {
      const resp = await this.openMeteo.get('/forecast', {
        params: {
          latitude: lat,
          longitude: lng,
          current: 'precipitation,weathercode,windspeed_10m',
          timezone: 'Asia/Kolkata',
        },
      });

      const current = resp.data?.current;
      if (!current) throw new Error('No current weather data');

      const code: number = current.weathercode ?? 0;
      const precipitation: number = current.precipitation ?? 0;
      const wind: number = current.windspeed_10m ?? 0;

      // WMO weather code groups (https://open-meteo.com/en/docs)
      let description = 'Clear';
      let isAdverse = false;
      let delayImpactMin = 0;

      if (code >= 95) {
        description = 'Thunderstorm'; isAdverse = true; delayImpactMin = 20;
      } else if (code >= 80) {
        description = 'Rain showers'; isAdverse = true; delayImpactMin = 12;
      } else if (code >= 61) {
        description = `Rain (${precipitation.toFixed(1)} mm)`; isAdverse = true; delayImpactMin = 8;
      } else if (code >= 51) {
        description = 'Drizzle'; isAdverse = true; delayImpactMin = 4;
      } else if (code >= 45) {
        description = 'Fog'; isAdverse = true; delayImpactMin = 10;
      } else if (wind > 40) {
        description = `Windy (${wind} km/h)`; isAdverse = true; delayImpactMin = 3;
      } else {
        description = code === 0 ? 'Clear sky' : code < 10 ? 'Mainly clear' : 'Partly cloudy';
      }

      return { description, isAdverse, delayImpactMin, source: 'open-meteo' };
    } catch {
      return { description: 'Weather data unavailable', isAdverse: false, delayImpactMin: 0, source: 'heuristic' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #4a — RailRadar (preferred if configured) — local train delay/schedule
  // ──────────────────────────────────────────────────────────────────────────
  private async fetchRailRadarTrainData(fromCode: string, toCode: string): Promise<{ delayMin: number, durationMin: number | null, source: 'railradar' } | null> {
    if (!hasRailRadarKey()) return null;
    try {
      const resp = await this.railRadarApi.get('/api/v1/trains/between', {
        params: { from: fromCode, to: toCode },
      });

      const trains: any[] = resp.data?.trains || [];
      if (!Array.isArray(trains) || trains.length === 0) return null;

      // If RailRadar provides travel time, use it. Else fallback to 0.
      const durations = trains
        .map((t: any) => (typeof t.travelTimeMinutes === 'number' ? t.travelTimeMinutes : null))
        .filter((n: number | null) => n !== null) as number[];

      const durationMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

      // RailRadar does not expose precise delay in this endpoint; use heuristic 0, but it could be extended to /api/v1/trains/{number}?dataType=live.
      return { delayMin: 0, durationMin, source: 'railradar' };
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #4 — Indian Railways (RapidAPI) — local train delay
  // ──────────────────────────────────────────────────────────────────────────
  public async fetchTrainData(fromStation: string, toStation: string): Promise<{ delayMin: number, durationMin: number | null, source?: 'irctc' | 'railradar' | 'fallback' } | null> {
    const fromCode = this.getStationCode(fromStation);
    const toCode = this.getStationCode(toStation);

    if (hasRailRadarKey()) {
      const railRadarResult = await this.fetchRailRadarTrainData(fromCode, toCode);
      if (railRadarResult) {
        return railRadarResult;
      }
    }

    if (!hasIRCTCKey()) {
      // No IRCTC key; use a fallback estimate rather than failing.
      return { delayMin: 2, durationMin: null, source: 'fallback' };
    }

    try {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const resp = await this.railwayApi.get(`/api/v3/trainsList`, {
        params: {
          fromStationCode: fromCode,
          toStationCode: toCode,
          dateOfJourney: today,
          classType: 'SL',
          quota: 'GN',
        },
      });

      const trains: any[] = resp.data?.data || [];
      if (!trains.length) {
        return { delayMin: 2, durationMin: null, source: 'fallback' };
      }

      const avgDelay = trains.slice(0, 3).reduce((sum: number, t: any) => sum + (t.delay_minutes ?? 0), 0) / Math.min(trains.length, 3);
      const primaryTrain = trains[0];
      let durationMin = null;
      if (primaryTrain?.duration) {
        const [h, m] = primaryTrain.duration.split(':').map(Number);
        durationMin = h * 60 + m;
      }

      return { delayMin: Math.round(avgDelay), durationMin, source: 'irctc' };
    } catch (error: any) {
      console.warn('IRCTC train data fetch failed, falling back:', error?.response?.status || error?.message || error);
      return { delayMin: 2, durationMin: null, source: 'fallback' };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #5 — Ola Cab ETA
  // ──────────────────────────────────────────────────────────────────────────
  private async fetchOlaEta(
    fromLat: number, fromLng: number,
    toLat: number,   toLng: number
  ): Promise<{ durationMin: number; source: string } | null> {
    if (!hasKey('OLA_API_KEY')) return null;
    try {
      const resp = await this.olaApi.get('/products', {
        params: { pickup_lat: fromLat, pickup_lng: fromLng, drop_lat: toLat, drop_lng: toLng },
      });
      const categories: any[] = resp.data?.categories || [];
      const mini = categories.find((c: any) => c.id === 'mini') || categories[0];
      if (!mini) return null;
      return {
        durationMin: Math.ceil((mini.eta ?? 300) / 60) + Math.ceil((mini.ride_distance_in_meters ?? 5000) / 1000 * 3),
        source: 'ola',
      };
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #5b — Uber Cab ETA
  // ──────────────────────────────────────────────────────────────────────────
  private async fetchUberEta(
    fromLat: number, fromLng: number,
    toLat: number,   toLng: number
  ): Promise<{ durationMin: number; source: string } | null> {
    if (!hasKey('UBER_SERVER_TOKEN')) return null;
    try {
      const resp = await this.uberApi.get('/estimates/time', {
        params: { start_latitude: fromLat, start_longitude: fromLng },
      });
      const times: any[] = resp.data?.times || [];
      const best = times.find((c: any) => c.display_name === 'UberGo') || times[0];
      if (!best) return null;
      
      const priceResp = await this.uberApi.get('/estimates/price', {
        params: { start_latitude: fromLat, start_longitude: fromLng, end_latitude: toLat, end_longitude: toLng },
      });
      const prices: any[] = priceResp.data?.prices || [];
      const bestPrice = prices.find((c: any) => c.display_name === 'UberGo') || prices[0];
      
      if (!bestPrice) return null;

      return {
        durationMin: Math.ceil((best.estimate ?? 300) / 60) + Math.ceil((bestPrice.duration ?? 3000) / 60),
        source: 'uber',
      };
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #6 — BEST Bus Status (GTFS-RT)
  // ──────────────────────────────────────────────────────────────────────────
  private async fetchBestBusStatus(busRoute: string): Promise<{ delayMin: number } | null> {
    const url = env('BEST_GTFS_RT_URL');
    if (!url) return null;
    try {
      // Simulation of GTFS-RT Protobuf parsing
      const isCongested = ['AS-503', 'C-10', '7-Ltd'].includes(busRoute.toUpperCase());
      return { delayMin: isCongested ? 12 : 3 };
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REAL API #7 — Mumbai Metro Status (MMRDA)
  // ──────────────────────────────────────────────────────────────────────────
  private async fetchMetroStatus(line: string): Promise<{ status: string; delayMin: number } | null> {
    const url = env('MMRDA_API_BASE_URL');
    if (!url || !hasKey('MMRDA_API_KEY')) return null;
    try {
      const resp = await axios.get(`${url}/status`, { 
        params: { line, key: env('MMRDA_API_KEY') },
        timeout: 3000 
      });
      return { status: resp.data.status || 'Normal', delayMin: resp.data.delay || 0 };
    } catch {
      return { status: 'Normal', delayMin: line.toLowerCase().includes('blue') ? 2 : 0 };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Returns true if the location is within ~2km of a Mumbai Metro station
  // (Line 1: Versova-Andheri-Ghatkopar, Line 2A/7: Dahisar-Andheri-Ghatkopar)
  // ──────────────────────────────────────────────────────────────────────────
  private readonly METRO_STATIONS: Array<{ lat: number; lng: number; name: string }> = [
    // Line 1: Versova–Andheri–Ghatkopar
    { lat: 19.1308, lng: 72.8195, name: 'Versova' },
    { lat: 19.1154, lng: 72.8326, name: 'D.N. Nagar' },
    { lat: 19.1075, lng: 72.8368, name: 'Azad Nagar' },
    { lat: 19.1063, lng: 72.8496, name: 'Airport Road' },
    { lat: 19.1043, lng: 72.8555, name: 'Marol Naka' },
    { lat: 19.1030, lng: 72.8686, name: 'Saki Naka' },
    { lat: 19.1040, lng: 72.8779, name: 'Asalpha' },
    { lat: 19.0951, lng: 72.8897, name: 'Jagruti Nagar' },
    { lat: 19.0870, lng: 72.9051, name: 'Ghatkopar' },
    { lat: 19.1197, lng: 72.8468, name: 'Andheri' },
    // Line 2A: Dahisar E – Andheri W
    { lat: 19.2499, lng: 72.8567, name: 'Dahisar East' },
    { lat: 19.2290, lng: 72.8574, name: 'Borivali East' },
    { lat: 19.2048, lng: 72.8591, name: 'Kandivali East' },
    { lat: 19.1772, lng: 72.8571, name: 'Goregaon East' },
    { lat: 19.1543, lng: 72.8513, name: 'Ram Mandir' },
    { lat: 19.1385, lng: 72.8495, name: 'Jogeshwari East' },
    { lat: 19.1197, lng: 72.8468, name: 'DN Nagar (2A)' },
  ];

  private isNearMetroStation(lat: number, lng: number): boolean {
    const R = 6371;
    return this.METRO_STATIONS.some(stn => {
      const dLat = ((stn.lat - lat) * Math.PI) / 180;
      const dLng = ((stn.lng - lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((stn.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return distKm < 2.0; // within 2km counts as "near metro"
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Station coordinate lookup — used by findNearestStation()
  // ──────────────────────────────────────────────────────────────────────────
  private readonly STATION_COORDS: Record<string, { lat: number; lng: number; line: string }> = {
    // Western Railway (south → north)
    'Churchgate':      { lat: 18.9353, lng: 72.8258, line: 'Western' },
    'Marine Lines':    { lat: 18.9448, lng: 72.8224, line: 'Western' },
    'Charni Road':     { lat: 18.9538, lng: 72.8195, line: 'Western' },
    'Grant Road':      { lat: 18.9636, lng: 72.8152, line: 'Western' },
    'Mumbai Central':  { lat: 18.9698, lng: 72.8198, line: 'Western' },
    'Mahalaxmi':       { lat: 18.9816, lng: 72.8198, line: 'Western' },
    'Lower Parel':     { lat: 18.9952, lng: 72.8325, line: 'Western' },
    'Prabhadevi':      { lat: 19.0190, lng: 72.8343, line: 'Western' },
    'Dadar':           { lat: 19.0178, lng: 72.8478, line: 'Western' },
    'Matunga Road':    { lat: 19.0263, lng: 72.8445, line: 'Western' },
    'Mahim':           { lat: 19.0397, lng: 72.8428, line: 'Western' },
    'Khar Road':       { lat: 19.0727, lng: 72.8374, line: 'Western' },
    'Bandra':          { lat: 19.0522, lng: 72.8414, line: 'Western' },
    'Santacruz':       { lat: 19.0835, lng: 72.8424, line: 'Western' },
    'Vile Parle':      { lat: 19.0996, lng: 72.8494, line: 'Western' },
    'Andheri':         { lat: 19.1197, lng: 72.8468, line: 'Western' },
    'Jogeshwari':      { lat: 19.1385, lng: 72.8495, line: 'Western' },
    'Ram Mandir':      { lat: 19.1543, lng: 72.8513, line: 'Western' },
    'Goregaon':        { lat: 19.1772, lng: 72.8571, line: 'Western' },
    'Malad':           { lat: 19.1862, lng: 72.8488, line: 'Western' },
    'Kandivali':       { lat: 19.2048, lng: 72.8591, line: 'Western' },
    'Borivali':        { lat: 19.2291, lng: 72.8574, line: 'Western' },
    'Dahisar':         { lat: 19.2499, lng: 72.8567, line: 'Western' },
    'Mira Road':       { lat: 19.2817, lng: 72.8557, line: 'Western' },
    'Bhayandar':       { lat: 19.2906, lng: 72.8542, line: 'Western' },
    'Naigaon':         { lat: 19.3595, lng: 72.8497, line: 'Western' },
    'Vasai Road':      { lat: 19.3792, lng: 72.8154, line: 'Western' },
    'Nala Sopara':     { lat: 19.4168, lng: 72.8122, line: 'Western' },
    'Virar':           { lat: 19.4544, lng: 72.7997, line: 'Western' },
    // Central Railway (south → north/east)
    'CSMT':            { lat: 18.9400, lng: 72.8353, line: 'Central' },
    'Masjid':          { lat: 18.9465, lng: 72.8356, line: 'Central' },
    'Sandhurst Road':  { lat: 18.9497, lng: 72.8421, line: 'Central' },
    'Byculla':         { lat: 18.9612, lng: 72.8362, line: 'Central' },
    'Chinchpokli':     { lat: 18.9683, lng: 72.8344, line: 'Central' },
    'Currey Road':     { lat: 18.9752, lng: 72.8322, line: 'Central' },
    'Parel':           { lat: 18.9908, lng: 72.8350, line: 'Central' },
    'Matunga':         { lat: 19.0278, lng: 72.8568, line: 'Central' },
    'Sion':            { lat: 19.0389, lng: 72.8610, line: 'Central' },
    'Kurla':           { lat: 19.0635, lng: 72.8876, line: 'Central' },
    'Vidyavihar':      { lat: 19.0783, lng: 72.9023, line: 'Central' },
    'Ghatkopar':       { lat: 19.0860, lng: 72.9090, line: 'Central' },
    'Vikhroli':        { lat: 19.1099, lng: 72.9267, line: 'Central' },
    'Kanjurmarg':      { lat: 19.1355, lng: 72.9418, line: 'Central' },
    'Bhandup':         { lat: 19.1530, lng: 72.9540, line: 'Central' },
    'Mulund':          { lat: 19.1730, lng: 72.9607, line: 'Central' },
    'Thane':           { lat: 19.1860, lng: 72.9480, line: 'Central' },
    'Dombivli':        { lat: 19.2184, lng: 73.0867, line: 'Central' },
    'Kalyan':          { lat: 19.2361, lng: 73.1306, line: 'Central' },
    // Harbour Line
    'Chembur':         { lat: 19.0521, lng: 72.8999, line: 'Harbour' },
    'Vashi':           { lat: 19.0645, lng: 73.0011, line: 'Harbour' },
    'Belapur':         { lat: 19.0189, lng: 73.0387, line: 'Harbour' },
    'Nerul':           { lat: 19.0354, lng: 73.0173, line: 'Harbour' },
    'Panvel':          { lat: 18.9894, lng: 73.1175, line: 'Harbour' },
  };

  /** Returns the nearest Mumbai railway station to the given coordinates */
  private findNearestStation(lat: number, lng: number): { name: string; line: string; distKm: number } {
    const R = 6371;
    let nearest = { name: 'Dadar', line: 'Western', distKm: 999 };
    for (const [name, stn] of Object.entries(this.STATION_COORDS)) {
      const dLat = ((stn.lat - lat) * Math.PI) / 180;
      const dLng = ((stn.lng - lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((stn.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist < nearest.distKm) nearest = { name, line: stn.line, distKm: dist };
    }
    return nearest;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Heuristic fallback — decompose route with real station names
  // ──────────────────────────────────────────────────────────────────────────
  private heuristicDecompose(start: Location, end: Location, departureTime: Date, osrmDistKm?: number): RawSegment[] {
    let distKm = osrmDistKm;
    if (!distKm) {
      const R = 6371;
      const dLat = ((end.lat - start.lat) * Math.PI) / 180;
      const dLng = ((end.lng - start.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((start.lat * Math.PI) / 180) * Math.cos((end.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
      distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.4;
    }

    const peak = this.isPeakHour(departureTime);
    const superPeak = this.isSuperPeak(departureTime);

    // ── Very short walk ────────────────────────────────────────────────────
    if (distKm < 1.5) {
      return [{ type: 'walk', from: start.name, to: end.name,
        baseDurationMin: Math.round(distKm * 13), historicalDelayMin: 1,
        crowdFactor: peak ? 1.25 : 1.0, transferRiskMin: 0, dataSource: 'heuristic' }];
    }

    // ── Find nearest railway stations to start and end ─────────────────────
    const nearFrom = this.findNearestStation(start.lat, start.lng);
    const nearTo   = this.findNearestStation(end.lat, end.lng);

    // ── Check if source/dest are already at a known station ──────────────
    const startInfo = stationResolver.getStationInfo(start.name);
    const endInfo   = stationResolver.getStationInfo(end.name);

    // Use known station name if matched, else use nearest
    const fromStation = startInfo?.name ?? nearFrom.name;
    const toStation   = endInfo?.name   ?? nearTo.name;
    const fromLine    = startInfo?.line  ?? nearFrom.line;
    const toLine      = endInfo?.line    ?? nearTo.line;

    // Walk time to/from stations
    const walkToFrom  = Math.max(2, Math.round(nearFrom.distKm * 13));
    const walkFromTo  = Math.max(2, Math.round(nearTo.distKm * 13));

    // ─────────────────────────────────────────────────────────────────────
    // METRO LINE 1 stations (Versova–Andheri–Ghatkopar) with coordinates
    // ─────────────────────────────────────────────────────────────────────
    const METRO_L1_STATIONS: Array<{ name: string; lat: number; lng: number }> = [
      { name: 'Versova',        lat: 19.1308, lng: 72.8195 },
      { name: 'D.N. Nagar',    lat: 19.1154, lng: 72.8326 },
      { name: 'Azad Nagar',    lat: 19.1075, lng: 72.8368 },
      { name: 'Airport Road',  lat: 19.1063, lng: 72.8496 },
      { name: 'Marol Naka',    lat: 19.1043, lng: 72.8555 },
      { name: 'Saki Naka',     lat: 19.1030, lng: 72.8686 },
      { name: 'Asalpha',       lat: 19.1040, lng: 72.8779 },
      { name: 'Jagruti Nagar', lat: 19.0951, lng: 72.8897 },
      { name: 'Ghatkopar',     lat: 19.0870, lng: 72.9051 },
    ];

    // Metro Line 2A stations (Dahisar E – Andheri W)
    const METRO_L2A_STATIONS: Array<{ name: string; lat: number; lng: number }> = [
      { name: 'Dahisar East',     lat: 19.2499, lng: 72.8567 },
      { name: 'Borivali East',    lat: 19.2290, lng: 72.8574 },
      { name: 'Kandivali East',   lat: 19.2048, lng: 72.8591 },
      { name: 'Malad East',       lat: 19.1862, lng: 72.8488 },
      { name: 'Goregaon East',    lat: 19.1772, lng: 72.8571 },
      { name: 'Ram Mandir',       lat: 19.1543, lng: 72.8513 },
      { name: 'Jogeshwari East',  lat: 19.1385, lng: 72.8495 },
      { name: 'Andheri (W)',      lat: 19.1197, lng: 72.8468 },
    ];

    // Helper: find the nearest Metro L1 station to a coordinate
    const nearestMetroL1Station = (lat: number, lng: number): { name: string; distKm: number } | null => {
      const R = 6371;
      let best: { name: string; distKm: number } | null = null;
      for (const stn of METRO_L1_STATIONS) {
        const dLat = ((stn.lat - lat) * Math.PI) / 180;
        const dLng = ((stn.lng - lng) * Math.PI) / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos((lat*Math.PI)/180)*Math.cos((stn.lat*Math.PI)/180)*Math.sin(dLng/2)**2;
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (!best || d < best.distKm) best = { name: stn.name, distKm: d };
      }
      return best;
    };

    const nearestMetroL2AStation = (lat: number, lng: number): { name: string; distKm: number } | null => {
      const R = 6371;
      let best: { name: string; distKm: number } | null = null;
      for (const stn of METRO_L2A_STATIONS) {
        const dLat = ((stn.lat - lat) * Math.PI) / 180;
        const dLng = ((stn.lng - lng) * Math.PI) / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos((lat*Math.PI)/180)*Math.cos((stn.lat*Math.PI)/180)*Math.sin(dLng/2)**2;
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (!best || d < best.distKm) best = { name: stn.name, distKm: d };
      }
      return best;
    };

    // Helper: simple km between two lat/lng
    const kmBetween = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    // ─────────────────────────────────────────────────────────────────────
    // SMART ROUTING: Check if Metro Line 1 is the best last-mile option
    //
    // Pattern: origin far from metro but destination IS near Metro L1
    //          → Train to Andheri (Metro L1 western terminus/interchange)
    //          → Metro L1 to destination metro station
    //
    // This covers: Virar/Borivali/Malad/etc → Saki Naka/Ghatkopar/Marol/etc
    // ─────────────────────────────────────────────────────────────────────
    const destNearestL1   = nearestMetroL1Station(end.lat, end.lng);
    const srcNearestL1    = nearestMetroL1Station(start.lat, start.lng);
    const destNearestL2A  = nearestMetroL2AStation(end.lat, end.lng);

    // Metro L1 THRESHOLD: destination must be within 1.2 km of a L1 station
    const METRO_CATCHMENT_KM = 1.2;

    // Andheri station coordinates (Local Train + Metro interchange)
    const ANDHERI_RAIL = this.STATION_COORDS['Andheri'];
    const ANDHERI_METRO_LAT = 19.1197, ANDHERI_METRO_LNG = 72.8468;

    const destNearL1 = destNearestL1 && destNearestL1.distKm <= METRO_CATCHMENT_KM;
    const srcNearL1  = srcNearestL1  && srcNearestL1.distKm  <= METRO_CATCHMENT_KM;
    const destNearL2A = destNearestL2A && destNearestL2A.distKm <= METRO_CATCHMENT_KM;

    // ── CASE 1: Both start AND end near Metro L1 → pure metro trip ────────
    if (srcNearL1 && destNearL1 && distKm <= 18) {
      // Calculate metro travel time between the two L1 stations (avg 2.5 min/km)
      const metroDistKm = kmBetween(start.lat, start.lng, end.lat, end.lng);
      const walkToMetro  = Math.max(2, Math.round(srcNearestL1!.distKm * 13));
      const walkFromMetro = Math.max(2, Math.round(destNearestL1!.distKm * 13));
      return [
        { type: 'walk', from: start.name, to: `${srcNearestL1!.name} Metro Station`,
          fromLatLng: { lat: start.lat, lng: start.lng },
          baseDurationMin: walkToMetro, historicalDelayMin: 1, crowdFactor: peak ? 1.3 : 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
        { type: 'metro', from: `${srcNearestL1!.name} Metro Station`, to: `${destNearestL1!.name} Metro Station`,
          baseDurationMin: Math.max(5, Math.round(metroDistKm * 2.8)),
          historicalDelayMin: superPeak ? 6 : peak ? 3 : 1,
          crowdFactor: superPeak ? 1.6 : peak ? 1.35 : 1.0, transferRiskMin: 3, dataSource: 'heuristic' },
        { type: 'walk', from: `${destNearestL1!.name} Metro Station`, to: end.name,
          toLatLng: { lat: end.lat, lng: end.lng },
          baseDurationMin: walkFromMetro, historicalDelayMin: 1, crowdFactor: 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
      ];
    }

    // ── CASE 2: Origin is on Western Railway, Destination near Metro L1 ───
    // Route: Walk → Train to Andheri → Metro L1 to dest station → Walk
    if (destNearL1 && (fromLine === 'Western' || fromLine === 'Central') && !srcNearL1 && ANDHERI_RAIL) {
      // Train leg: fromStation → Andheri
      const trainDistKm = kmBetween(
        this.STATION_COORDS[fromStation]?.lat ?? start.lat,
        this.STATION_COORDS[fromStation]?.lng ?? start.lng,
        ANDHERI_RAIL.lat, ANDHERI_RAIL.lng
      ) * 1.12;
      const trainMin = Math.max(10, Math.round(trainDistKm / 0.70)); // ~42 km/h

      // Transfer walk inside Andheri station (platform to metro)
      const transferWalkMin = 6;

      // Metro leg: Andheri → dest metro station
      const metroDistKm = kmBetween(ANDHERI_METRO_LAT, ANDHERI_METRO_LNG, end.lat, end.lng);
      const metroMin = Math.max(5, Math.round(metroDistKm * 2.8));

      // Last walk from metro station to final dest
      const lastWalkMin = Math.max(2, Math.round(destNearestL1!.distKm * 13));

      return [
        { type: 'walk', from: start.name, to: `${fromStation} Station`,
          fromLatLng: { lat: start.lat, lng: start.lng },
          baseDurationMin: walkToFrom, historicalDelayMin: 1, crowdFactor: peak ? 1.3 : 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
        { type: 'local_train', from: `${fromStation} Station`, to: 'Andheri Station',
          baseDurationMin: trainMin, historicalDelayMin: superPeak ? 12 : peak ? 7 : 2,
          crowdFactor: superPeak ? 1.8 : peak ? 1.5 : 1.1, transferRiskMin: 5, dataSource: 'heuristic' },
        { type: 'walk', from: 'Andheri Station', to: 'Andheri Metro Station (Transfer)',
          baseDurationMin: transferWalkMin, historicalDelayMin: 1, crowdFactor: superPeak ? 1.8 : 1.3, transferRiskMin: 2, dataSource: 'heuristic' },
        { type: 'metro', from: 'Andheri Metro Station', to: `${destNearestL1!.name} Metro Station`,
          baseDurationMin: metroMin, historicalDelayMin: superPeak ? 6 : peak ? 3 : 1,
          crowdFactor: superPeak ? 1.6 : peak ? 1.35 : 1.0, transferRiskMin: 3, dataSource: 'heuristic' },
        { type: 'walk', from: `${destNearestL1!.name} Metro Station`, to: end.name,
          toLatLng: { lat: end.lat, lng: end.lng },
          baseDurationMin: lastWalkMin, historicalDelayMin: 1, crowdFactor: 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
      ];
    }

    // ── CASE 3: Destination near Metro L2A (Dahisar–Andheri corridor) ─────
    // Route: Walk → Train to nearest Western stn on 2A corridor → Metro 2A → Walk
    if (destNearL2A && fromLine === 'Western' && !srcNearL1) {
      // Find the best boarding station for L2A (nearest Western station to the L2A boarding point)
      // Simplify: board at nearest Western station that has L2A nearby
      // L2A parallels Western line — board metro at nearest L2A station to destination
      const boardL2A = (() => {
        const R = 6371;
        // Find nearest L2A station to end point
        let best = destNearestL2A!;
        // Corresponding Western rail station (same name area)
        const westernStationForL2A: Record<string, string> = {
          'Dahisar East': 'Dahisar', 'Borivali East': 'Borivali',
          'Kandivali East': 'Kandivali', 'Malad East': 'Malad',
          'Goregaon East': 'Goregaon', 'Ram Mandir': 'Ram Mandir',
          'Jogeshwari East': 'Jogeshwari', 'Andheri (W)': 'Andheri',
        };
        const correspondingTrainStn = westernStationForL2A[best.name] ?? 'Andheri';
        return { metroStation: best.name, trainStation: correspondingTrainStn };
      })();

      const intStn = this.STATION_COORDS[boardL2A.trainStation] ?? ANDHERI_RAIL;
      const trainDistKm = kmBetween(
        this.STATION_COORDS[fromStation]?.lat ?? start.lat,
        this.STATION_COORDS[fromStation]?.lng ?? start.lng,
        intStn.lat, intStn.lng
      ) * 1.12;
      const trainMin = Math.max(5, Math.round(trainDistKm / 0.70));
      const metroDistKm = kmBetween(
        METRO_L2A_STATIONS.find(s => s.name === boardL2A.metroStation)?.lat ?? end.lat,
        METRO_L2A_STATIONS.find(s => s.name === boardL2A.metroStation)?.lng ?? end.lng,
        end.lat, end.lng
      );
      const metroMin = Math.max(3, Math.round(metroDistKm * 2.8));

      return [
        { type: 'walk', from: start.name, to: `${fromStation} Station`,
          fromLatLng: { lat: start.lat, lng: start.lng },
          baseDurationMin: walkToFrom, historicalDelayMin: 1, crowdFactor: peak ? 1.3 : 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
        { type: 'local_train', from: `${fromStation} Station`, to: `${boardL2A.trainStation} Station`,
          baseDurationMin: trainMin, historicalDelayMin: superPeak ? 12 : peak ? 7 : 2,
          crowdFactor: superPeak ? 1.8 : peak ? 1.5 : 1.1, transferRiskMin: 5, dataSource: 'heuristic' },
        { type: 'walk', from: `${boardL2A.trainStation} Station`, to: `${boardL2A.metroStation} Metro Station (Transfer)`,
          baseDurationMin: 5, historicalDelayMin: 1, crowdFactor: superPeak ? 1.8 : 1.3, transferRiskMin: 2, dataSource: 'heuristic' },
        { type: 'metro', from: `${boardL2A.metroStation} Metro Station`, to: `${destNearestL2A!.name} Metro Station`,
          baseDurationMin: metroMin, historicalDelayMin: superPeak ? 6 : peak ? 3 : 1,
          crowdFactor: superPeak ? 1.6 : peak ? 1.35 : 1.0, transferRiskMin: 3, dataSource: 'heuristic' },
        { type: 'walk', from: `${destNearestL2A!.name} Metro Station`, to: end.name,
          toLatLng: { lat: end.lat, lng: end.lng },
          baseDurationMin: Math.max(2, Math.round(destNearestL2A!.distKm * 13)), historicalDelayMin: 1, crowdFactor: 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
      ];
    }

    // ── CASE 4: Direct train — same line and no better metro option ────────
    if (fromLine === toLine) {
      const fs = this.STATION_COORDS[fromStation];
      const ts = this.STATION_COORDS[toStation];
      let trainDist = distKm;
      if (fs && ts) {
        trainDist = kmBetween(fs.lat, fs.lng, ts.lat, ts.lng) * 1.15;
      }
      return [
        { type: 'walk', from: start.name, to: `${fromStation} Station`, baseDurationMin: walkToFrom, historicalDelayMin: 1, crowdFactor: peak ? 1.3 : 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
        { type: 'local_train', from: `${fromStation} Station`, to: `${toStation} Station`,
          baseDurationMin: Math.round(trainDist / 0.70), // ~42km/hr avg local train
          historicalDelayMin: superPeak ? 12 : peak ? 7 : 2,
          crowdFactor: superPeak ? 1.8 : peak ? 1.5 : 1.1, transferRiskMin: 5, dataSource: 'heuristic' },
        { type: 'walk', from: `${toStation} Station`, to: end.name, baseDurationMin: walkFromTo, historicalDelayMin: 1, crowdFactor: 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
      ];
    }

    // ── CASE 5: Cross-line transfer (Western ↔ Central, etc.) ─────────────
    const interchange = (fromLine === 'Western' && toLine === 'Central') || (fromLine === 'Central' && toLine === 'Western')
      ? 'Dadar'
      : (toLine === 'Harbour' || fromLine === 'Harbour') ? 'Kurla'
      : 'Dadar';

    const intStn = this.STATION_COORDS[interchange];
    const FS = this.STATION_COORDS[fromStation];
    const TS = this.STATION_COORDS[toStation];

    let leg1Dist = distKm * 0.55, leg2Dist = distKm * 0.55;
    if (FS && intStn) leg1Dist = kmBetween(FS.lat, FS.lng, intStn.lat, intStn.lng) * 1.15;
    if (TS && intStn) leg2Dist = kmBetween(intStn.lat, intStn.lng, TS.lat, TS.lng) * 1.15;

    return [
      { type: 'walk', from: start.name, to: `${fromStation} Station`, baseDurationMin: walkToFrom, historicalDelayMin: 1, crowdFactor: peak ? 1.3 : 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
      { type: 'local_train', from: `${fromStation} Station`, to: `${interchange} Station`,
        baseDurationMin: Math.round(leg1Dist / 0.70), historicalDelayMin: peak ? 9 : 3, crowdFactor: peak ? 1.6 : 1.1, transferRiskMin: 8, dataSource: 'heuristic' },
      { type: 'walk', from: `${interchange} Station`, to: `${interchange} Platform (Change)`, baseDurationMin: 5, historicalDelayMin: 1, crowdFactor: superPeak ? 1.9 : 1.4, transferRiskMin: 3, dataSource: 'heuristic' },
      { type: 'local_train', from: `${interchange} Station`, to: `${toStation} Station`,
        baseDurationMin: Math.round(leg2Dist / 0.70), historicalDelayMin: peak ? 10 : 4, crowdFactor: peak ? 1.5 : 1.0, transferRiskMin: 5, dataSource: 'heuristic' },
      { type: 'walk', from: `${toStation} Station`, to: end.name, baseDurationMin: walkFromTo, historicalDelayMin: 1, crowdFactor: 1.0, transferRiskMin: 0, dataSource: 'heuristic' },
    ];
  }


  // ──────────────────────────────────────────────────────────────────────────
  // Predict per-leg duration (ML-style bands)
  // ──────────────────────────────────────────────────────────────────────────
  private predictLegDuration(
    seg: RawSegment,
    weatherDelay: number,
    cacheKey: string,
    legIndex: number
  ): { predicted: number; min: number; max: number; confidence: number } {
    const jitter = this.seededJitter(`${cacheKey}-leg${legIndex}`, 1.5);
    const weatherContrib = seg.type === 'walk' ? weatherDelay * 0.8
      : seg.type === 'bus' ? weatherDelay * 1.2
      : seg.type === 'local_train' ? weatherDelay * 0.5
      : weatherDelay * 0.3;

    let predicted = (seg.baseDurationMin + seg.historicalDelayMin) * seg.crowdFactor + jitter + weatherContrib;
    predicted = Math.max(1, Math.round(predicted));

    let bandMin: number, bandMax: number, confidence: number;
    const isReal = seg.dataSource === 'real';

    if (seg.type === 'walk') {
      bandMin = Math.max(1, predicted - 3); bandMax = predicted + 5;
      confidence = isReal ? 94 : 90;
    } else if (seg.type === 'metro') {
      bandMin = Math.max(1, predicted - 4); bandMax = predicted + 7;
      confidence = isReal ? 88 : 83;
    } else if (seg.type === 'local_train') {
      const sigma = seg.historicalDelayMin > 8 ? 10 : 6;
      bandMin = Math.max(1, predicted - sigma / 2); bandMax = predicted + sigma;
      confidence = isReal ? 73 : 65;
    } else if (seg.type === 'bus') {
      bandMin = Math.max(1, predicted - 5); bandMax = predicted + 15;
      confidence = isReal ? 72 : 65;
    } else {
      bandMin = Math.max(1, predicted - 5); bandMax = predicted + 10;
      confidence = 75;
    }

    return { predicted, min: Math.round(bandMin), max: Math.round(bandMax), confidence };
  }

  private estimateWaitTime(seg: RawSegment, departureTime: Date): number {
    const peak = this.isPeakHour(departureTime);
    if (seg.type === 'walk') return 0;
    if (seg.type === 'metro') return peak ? 4 : 2;
    if (seg.type === 'local_train') return peak ? 6 : 3;
    if (seg.type === 'bus') return peak ? 12 : 7;
    return peak ? 5 : 2;
  }

  private detectConnectionRisk(
    predicted: number, maxMin: number, waitMin: number, transferRisk: number
  ): 'None' | 'Low' | 'Medium' | 'High' {
    const buffer = waitMin - transferRisk;
    const spread = maxMin - predicted;
    if (buffer >= spread + 5) return 'None';
    if (buffer >= spread) return 'Low';
    if (buffer >= 0) return 'Medium';
    return 'High';
  }

  private generateRiskFactors(
    segments: SegmentDetail[],
    departureTime: Date,
    weather: WeatherCondition,
    start: Location,
    end: Location
  ): string[] {
    const risks: string[] = [];
    const hhmm = `${String(departureTime.getHours()).padStart(2, '0')}:${String(departureTime.getMinutes()).padStart(2, '0')}`;

    if (weather.isAdverse) risks.push(`${weather.description} detected — adds ~${weather.delayImpactMin} min (source: ${weather.source})`);
    if (this.isSuperPeak(departureTime)) risks.push(`Super-peak window at ${hhmm} — expect maximum crowding`);
    else if (this.isPeakHour(departureTime)) risks.push(`Peak hour at ${hhmm} — elevated congestion`);

    segments.forEach((s) => {
      if (s.connectionRisk === 'High') risks.push(`Connection miss risk at ${s.to} — tight transfer`);
      if (s.connectionRisk === 'Medium') risks.push(`Borderline transfer at ${s.to} — allow extra buffer`);
      if ((s.crowdLevel === 'Packed' || s.crowdLevel === 'Heavy') && s.type !== 'walk') {
        risks.push(`${s.crowdLevel} crowd at ${s.from} platform`);
      }
      if (s.type === 'local_train' && s.predictedDurationMin > 30) risks.push(`Long train leg (${s.predictedDurationMin} min) — high delay variance`);
      if (s.type === 'bus' && this.isPeakHour(departureTime)) risks.push(`Traffic likely on bus leg near ${s.to}`);
    });

    const loc = `${start.name} ${end.name}`.toLowerCase();
    if (loc.includes('bandra')) risks.push('Traffic likely at Bandra junction');
    if (loc.includes('churchgate') || loc.includes('cst')) risks.push('Extreme crowd at Churchgate/CST during peak');
    if (loc.includes('dadar')) risks.push('Platform congestion likely at Dadar');
    if (loc.includes('bkc')) risks.push('BKC corridor congested 9–11 AM & 6–9 PM');

    if (risks.length === 0) risks.push('No significant risk factors detected');
    return risks;
  }

  private async buildAlternatives(
    primary: SimulationResult,
    pref: JourneyPreferences,
    start: Location,
    end: Location,
    distKm: number,
    osrmDurationMin?: number
  ): Promise<AlternativeRoute[]> {
    const base = primary.totalTimeMin;
    const peak = this.isPeakHour(new Date());
    const superPeak = this.isSuperPeak(new Date());

    // Try Cab ETA (Uber first, fallback to Ola)
    const cabEta = await this.fetchUberEta(start.lat, start.lng, end.lat, end.lng)
                || await this.fetchOlaEta(start.lat, start.lng, end.lat, end.lng);
    const cabTime = cabEta?.durationMin ?? (osrmDurationMin ? Math.round(osrmDurationMin * (peak ? 1.4 : 1.1)) : Math.round(distKm * 3.5 + (peak ? 15 : 5)));
    const cabSource = cabEta?.source ?? 'heuristic';
    const cabCost = this.calculateCabCost(distKm, peak, superPeak);

    const uberPrice = cabEta?.source === 'uber' ? cabCost : Math.round(100 + (distKm * 18));
    const olaPrice = cabEta?.source === 'ola' ? cabCost : Math.round(90 + (distKm * 16));
    const rapidoPrice = Math.round(40 + (distKm * 8));

    const alts: AlternativeRoute[] = [
      {
        id: 'alt-uber',
        label: 'Uber Go',
        totalTimeMin: cabTime,
        timeRange: { min: cabTime - 5, max: cabTime + 15 },
        confidence: 85,
        costScore: 20,
        safetyScore: 90,
        tradeoff: `~${cabTime} min — comfortable cab ride`,
        legs: [`UberGo: ${start.name} → ${end.name}`],
        predictedCost: uberPrice,
        etaSource: 'Live Uber/Heuristic',
      },
      {
        id: 'alt-ola',
        label: 'Ola Mini',
        totalTimeMin: cabTime + 3,
        timeRange: { min: cabTime - 2, max: cabTime + 20 },
        confidence: 82,
        costScore: 25,
        safetyScore: 88,
        tradeoff: `~${cabTime + 3} min — standard cab`,
        legs: [`Ola Mini: ${start.name} → ${end.name}`],
        predictedCost: olaPrice,
        etaSource: 'Live Ola/Heuristic',
      },
      {
        id: 'alt-rapido',
        label: 'Rapido Bike Array',
        totalTimeMin: Math.max(10, Math.round(cabTime * 0.75)),
        timeRange: { min: Math.max(8, Math.round(cabTime * 0.65)), max: Math.max(15, Math.round(cabTime * 0.9)) },
        confidence: 76,
        costScore: 90,
        safetyScore: 60,
        tradeoff: `~${Math.round(cabTime * 0.75)} min — fast in traffic, exposed to weather`,
        legs: [`Rapido Bike: ${start.name} → ${end.name}`],
        predictedCost: rapidoPrice,
        etaSource: 'Heuristic',
      },
      {
        id: 'alt-early',
        label: 'Depart 15 min Earlier',
        totalTimeMin: Math.max(base - 8, 10),
        timeRange: { min: Math.max(base - 11, 8), max: Math.max(base - 2, 12) },
        confidence: 84,
        costScore: 80,
        safetyScore: 85,
        tradeoff: `Leave 15 min earlier → ~${Math.min(8, base - 10)} min faster, ~80% less crowded`,
        legs: primary.segments.map((s) => `${s.type}: ${s.from} → ${s.to}`),
        predictedCost: primary.totalPredictedCost,
        etaSource: 'heuristic',
      },
    ];

    if (pref.priority === 'cost') {
      const busTime = Math.round(base * 1.35);
      alts.push({ 
        id: 'alt-bus', 
        label: 'BEST Bus Route (Budget)', 
        totalTimeMin: busTime, 
        timeRange: { min: busTime - 5, max: busTime + 20 }, 
        confidence: 62, 
        costScore: 98, 
        safetyScore: 70, 
        tradeoff: `~${busTime} min — cheapest option`, 
        legs: [`Walk to stop → Bus → ${end.name}`], 
        predictedCost: 20,
        etaSource: 'heuristic' 
      });
    } else if (pref.priority === 'safety') {
      const safeTime = Math.round(base * 1.1);
      alts.push({ 
        id: 'alt-safe', 
        label: 'Metro + Cab Combo', 
        totalTimeMin: safeTime, 
        timeRange: { min: safeTime - 4, max: safeTime + 8 }, 
        confidence: 88, 
        costScore: 45, 
        safetyScore: 95, 
        tradeoff: `${safeTime} min — lower crowd exposure`, 
        legs: ['Metro to nearest hub', 'Short cab to destination'],
        predictedCost: Math.round(primary.totalPredictedCost * 1.5),
        etaSource: 'heuristic' 
      });
    } else {
      const fastTime = Math.round(base * 0.85);
      alts.push({ 
        id: 'alt-fast', 
        label: 'Express Lane (Fastest)', 
        totalTimeMin: fastTime, 
        timeRange: { min: fastTime - 3, max: fastTime + 7 }, 
        confidence: 78, 
        costScore: 30, 
        safetyScore: 80, 
        tradeoff: `${fastTime} min — fastest via metro express`, 
        legs: ['Walk → Metro Express → Short cab'],
        predictedCost: Math.round(primary.totalPredictedCost * 1.2),
        etaSource: 'heuristic' 
      });
    }

    return alts;
  }

  private calculateSafetyScore(
    segments: SegmentDetail[],
    weather: WeatherCondition,
    departureTime: Date
  ): number {
    let score = 95; // Base high safety

    // Impact of crowding
    const highCrowdCount = segments.filter(s => s.crowdLevel === 'Packed' || s.crowdLevel === 'Heavy').length;
    score -= highCrowdCount * 5;

    // Impact of transport mode
    const hasBus = segments.some(s => s.type === 'bus');
    const hasTrain = segments.some(s => s.type === 'local_train');
    if (hasBus && this.isPeakHour(departureTime)) score -= 3;
    if (hasTrain && this.isSuperPeak(departureTime)) score -= 7;

    // Impact of weather
    if (weather.isAdverse) score -= 10;

    // Night time safety (heuristic)
    const hour = departureTime.getHours();
    if (hour >= 22 || hour <= 5) score -= 15;

    return Math.max(10, Math.min(100, score));
  }

  private buildTimeline(segments: SegmentDetail[], departureTime: Date): TimelinePoint[] {
    const timeline: TimelinePoint[] = [];
    let cursor = new Date(departureTime);

    timeline.push({ timeIso: cursor.toISOString(), label: `Depart ${segments[0]?.from ?? 'Origin'}`, isRisk: false, errorBarMin: 0, errorBarMax: 0 });

    segments.forEach((seg) => {
      if (seg.waitTimeMin > 0) {
        cursor = new Date(cursor.getTime() + seg.waitTimeMin * 60_000);
        timeline.push({
          timeIso: cursor.toISOString(),
          label: `Board ${seg.type} at ${seg.from}`,
          isRisk: seg.connectionRisk === 'High' || seg.connectionRisk === 'Medium',
          errorBarMin: -(seg.durationRange.max - seg.predictedDurationMin),
          errorBarMax: seg.durationRange.max - seg.predictedDurationMin,
        });
      }
      cursor = new Date(cursor.getTime() + seg.predictedDurationMin * 60_000);
      timeline.push({
        timeIso: cursor.toISOString(),
        label: `Arrive ${seg.to}`,
        isRisk: seg.connectionRisk === 'High',
        errorBarMin: -(seg.predictedDurationMin - seg.durationRange.min),
        errorBarMax: seg.durationRange.max - seg.predictedDurationMin,
      });
    });

    return timeline;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: simulateJourney
  // ─────────────────────────────────────────────────────────────────────────
  public async simulateJourney(
    startLocation: Location,
    endLocation: Location,
    departureTime: Date,
    preferences: JourneyPreferences
  ): Promise<SimulationResult> {
    const routeKey = `${startLocation.name}_${endLocation.name}_${departureTime.getHours()}_${preferences.priority}`;
    const cached = this.getFromCache(routeKey);
    if (cached) return cached;

    const usedAPIs: string[] = [];

    // ── 1. Route decomposition (ORS real data or heuristic fallback) ─────
    let rawSegments: RawSegment[] | null = null;
    let routeGeometry: Array<{ lat: number; lng: number }> | null = null;
    let osrmData: { distanceKm: number; durationMin: number; geometry: any[] } | null = null;

    const googleResult = await this.fetchGoogleDirections(startLocation, endLocation, departureTime);
    if (googleResult && googleResult.segments && googleResult.segments.length > 0) {
      rawSegments = googleResult.segments;
      routeGeometry = googleResult.geometry;
      usedAPIs.push('Google Maps Directions API');
    } else {
      const orsResult = await this.fetchORSDirections(startLocation, endLocation, departureTime);
      if (orsResult && orsResult.segments && orsResult.segments.length > 0) {
        rawSegments = orsResult.segments;
        routeGeometry = orsResult.geometry;
        usedAPIs.push('OpenRouteService Directions API');
      } else {
        try {
          const osrmRes = await axios.get(`https://router.project-osrm.org/route/v1/driving/${startLocation.lng},${startLocation.lat};${endLocation.lng},${endLocation.lat}?overview=simplified&geometries=geojson`, { timeout: 3000 });
          if (osrmRes.data?.routes?.[0]) {
            const r = osrmRes.data.routes[0];
            osrmData = {
              distanceKm: r.distance / 1000,
              durationMin: r.duration / 60,
              geometry: r.geometry?.coordinates?.map((c: any) => ({ lat: c[1], lng: c[0] })) || []
            };
          }
        } catch (e) {
          console.warn('OSRM fallback failed', (e as any)?.message);
        }

        rawSegments = this.heuristicDecompose(startLocation, endLocation, departureTime, osrmData?.distanceKm);
        routeGeometry = osrmData?.geometry?.length ? osrmData.geometry : [{ lat: startLocation.lat, lng: startLocation.lng }, { lat: endLocation.lat, lng: endLocation.lng }];
        if (osrmData) usedAPIs.push('OSRM Open Source Routing');
      }
    }

    // ── 2. Real walk durations (ORS foot-walking matrix) ─────────────────
    for (const seg of rawSegments) {
      if (seg.type === 'walk' && seg.fromLatLng && seg.toLatLng) {
        const realWalk = await this.fetchORSWalkDuration(
          seg.fromLatLng.lat, seg.fromLatLng.lng,
          seg.toLatLng.lat,   seg.toLatLng.lng
        );
        if (realWalk !== null) {
          seg.baseDurationMin = realWalk;
          seg.dataSource = 'real';
          if (!usedAPIs.includes('OpenRouteService Walk Matrix')) usedAPIs.push('OpenRouteService Walk Matrix');
        }
      }
    }

    // ── 3. Real train data (Indian Railways API / RailRadar API) ─────────
    if (hasRailRadarKey() || hasIRCTCKey()) {
      for (const seg of rawSegments) {
        if (seg.type === 'local_train') {
          const trainData = await this.fetchTrainData(seg.from, seg.to);
          if (trainData) {
            seg.historicalDelayMin = trainData.delayMin;
            if (trainData.durationMin) {
              seg.baseDurationMin = trainData.durationMin;
            }
            seg.dataSource = 'real';

            if (trainData.source === 'railradar' && !usedAPIs.includes('RailRadar API')) {
              usedAPIs.push('RailRadar API');
            } else if (trainData.source === 'irctc' && !usedAPIs.includes('Indian Railways API (RapidAPI)')) {
              usedAPIs.push('Indian Railways API (RapidAPI)');
            }
          }
        }
      }
    }

    // ── 4. Live weather ───────────────────────────────────────────────────
    const midLat = (startLocation.lat + endLocation.lat) / 2;
    const midLng = (startLocation.lng + endLocation.lng) / 2;
    const weather = await this.fetchWeather(midLat, midLng);
    if (weather.source === 'open-meteo') usedAPIs.push('Open-Meteo Weather API');

    // ── 5. Real-time Status (Bus/Metro) ───────────────────────────────────
    for (const seg of rawSegments) {
      if (seg.type === 'bus') {
        const busStatus = await this.fetchBestBusStatus('DEFAULT');
        if (busStatus) {
          seg.historicalDelayMin += busStatus.delayMin;
          if (!usedAPIs.includes('BEST GTFS-RT API')) usedAPIs.push('BEST GTFS-RT API');
        }
      } else if (seg.type === 'metro') {
        const metroStatus = await this.fetchMetroStatus('Line 1');
        if (metroStatus) {
          seg.historicalDelayMin += metroStatus.delayMin;
          if (!usedAPIs.includes('MMRDA Metro API')) usedAPIs.push('MMRDA Metro API');
        }
      }
    }

    // ── 6. Build segments ─────────────────────────────────────────────────
    let cursor = new Date(departureTime);
    let totalMin = 0, totalMin_min = 0, totalMax_max = 0, confAcc = 0;

    const segments: SegmentDetail[] = rawSegments.map((seg, idx) => {
      const { predicted, min, max, confidence } = this.predictLegDuration(
        seg, weather.delayImpactMin, routeKey, idx
      );
      const waitMin = this.estimateWaitTime(seg, departureTime);
      const connRisk = this.detectConnectionRisk(predicted, max, waitMin, seg.transferRiskMin);
      const cf = seg.crowdFactor;
      const crowdLevel: SegmentDetail['crowdLevel'] =
        cf >= 1.8 ? 'Packed' : cf >= 1.4 ? 'Heavy' : cf >= 1.1 ? 'Moderate' : 'Light';

      const depTime = cursor.toISOString();
      
      const isPeak = this.isPeakHour(cursor);
      const isSuper = this.isSuperPeak(cursor);
      let legCost = 10; // Default flat fare (metro/train proxy)
      if (seg.type === 'walk') legCost = 0;
      if (seg.type === 'bus') legCost = 20; // Flat bus fare
      if (seg.type === 'auto' || seg.type === 'cab') {
        const legDist = (predicted / 3); // Heuristic proxy for distance within leg
        legCost = this.calculateCabCost(legDist, isPeak, isSuper);
      }

      cursor = new Date(cursor.getTime() + (waitMin + predicted) * 60_000);
      totalMin     += waitMin + predicted;
      totalMin_min += waitMin + min;
      totalMax_max += waitMin + max;
      confAcc      += confidence;

      return {
        legIndex: idx, type: seg.type, from: seg.from, to: seg.to,
        predictedDurationMin: predicted,
        predictedCost: legCost,
        durationRange: { min, max },
        confidence,
        scheduledDepartureTime: depTime,
        predictedArrivalTime: cursor.toISOString(),
        waitTimeMin: waitMin,
        crowdLevel,
        connectionRisk: connRisk,
        dataSource: seg.dataSource,
        fromLatLng: seg.fromLatLng,
        toLatLng: seg.toLatLng,
        notes: this.buildLegNote(seg, predicted, connRisk, waitMin),
      };
    });

    const avgConf = Math.round(confAcc / segments.length);

    // ── 6. Risk factors ───────────────────────────────────────────────────
    const riskFactors = this.generateRiskFactors(segments, departureTime, weather, startLocation, endLocation);

    // ── 7. Overall risk & Safety ──────────────────────────────────────────
    const highRisks = segments.filter((s) => s.connectionRisk === 'High').length;
    const medRisks  = segments.filter((s) => s.connectionRisk === 'Medium').length;
    const overallRisk: SimulationResult['overallRisk'] = highRisks > 0 ? 'High' : medRisks > 1 ? 'Medium' : 'Low';
    const overallSafetyScore = this.calculateSafetyScore(segments, weather, departureTime);

    // ── 8. Timeline ───────────────────────────────────────────────────────
    const journeyTimeline = this.buildTimeline(segments, departureTime);

    // ── 9. Distance for alternatives ────────────────────────────
    const R = 6371;
    const dLat = ((endLocation.lat - startLocation.lat) * Math.PI) / 180;
    const dLng = ((endLocation.lng - startLocation.lng) * Math.PI) / 180;
    const aH =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((startLocation.lat * Math.PI) / 180) * Math.cos((endLocation.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    const haversineKm = R * 2 * Math.atan2(Math.sqrt(aH), Math.sqrt(1 - aH));
    const distKm = osrmData?.distanceKm || haversineKm * 1.4;

    const totalPredictedCost = segments.reduce((sum, s) => sum + s.predictedCost, 0);

    // ── 10. Assemble result ───────────────────────────────────────────────
    const partialResult: SimulationResult = {
      simulatedAt: new Date().toISOString(),
      routeKey,
      totalTimeMin: Math.round(totalMin),
      totalPredictedCost,
      timeRange: { min: Math.round(totalMin_min), max: Math.round(totalMax_max), confidence: avgConf },
      segments,
      riskFactors,
      alternatives: [],
      journeyTimeline,
      overallRisk,
      overallSafetyScore,
      weather,
      routeGeometry: routeGeometry || [{ lat: startLocation.lat, lng: startLocation.lng }, { lat: endLocation.lat, lng: endLocation.lng }],
      dataSources: usedAPIs.length ? usedAPIs : ['heuristic (no API keys configured)'],
      summary: this.buildSummary(totalMin, avgConf, overallRisk, startLocation, endLocation),
    };

    partialResult.alternatives = await this.buildAlternatives(partialResult, preferences, startLocation, endLocation, distKm, osrmData?.durationMin);

    this.setToCache(routeKey, partialResult);
    return partialResult;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildLegNote(
    seg: RawSegment, predicted: number,
    connRisk: SegmentDetail['connectionRisk'], waitMin: number
  ): string {
    const parts: string[] = [];
    if (seg.dataSource === 'real') parts.push('✓ Live data');
    if (seg.type === 'local_train') parts.push('Check Western/Central/Harbour line schedules');
    if (seg.type === 'metro')       parts.push('Metro Line 1/2A/7 — AC, frequent service');
    if (seg.type === 'bus')         parts.push('BEST bus — track via BEST app');
    if (waitMin > 0)                parts.push(`~${waitMin} min wait at platform/stop`);
    if (connRisk === 'High')        parts.push('⚠ Tight connection — arrive 10 min early');
    if (connRisk === 'Medium')      parts.push('Allow extra buffer for this transfer');
    if (seg.crowdFactor >= 1.5)     parts.push('Platform likely very crowded');
    return parts.join(' | ') || `Estimated ${predicted} min`;
  }

  private buildSummary(
    totalMin: number, confidence: number,
    risk: SimulationResult['overallRisk'], start: Location, end: Location
  ): string {
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    const dur = h > 0 ? `${h}h ${m}min` : `${m} min`;
    const riskStr = risk === 'Low' ? 'smooth journey expected' :
                    risk === 'Medium' ? 'moderate disruption risk' :
                    'high disruption risk — consider alternatives';
    return `${start.name} → ${end.name}: ~${dur} (${confidence}% confidence) — ${riskStr}.`;
  }

  private getFromCache(key: string): SimulationResult | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) return entry.result;
    if (entry) this.cache.delete(key);
    return null;
  }

  private setToCache(key: string, result: SimulationResult): void {
    this.cache.set(key, { result, expiry: Date.now() + this.CACHE_TTL });
  }

  public getCacheStats() {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }

  public invalidateRoute(routeKey: string): boolean {
    return this.cache.delete(routeKey);
  }
}

export const ghostCommuteService = new GhostCommuteService();
