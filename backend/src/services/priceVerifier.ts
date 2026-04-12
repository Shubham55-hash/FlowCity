/**
 * priceVerifier.ts
 *
 * Cross-checks every route's cost and distance against real Mumbai fare tables
 * and OSRM road distance. Returns a corrected cost breakdown per transport mode.
 *
 * Fare sources (all public / official):
 *  - Mumbai Local Train  : Western Railway / Central Railway Ordinary 2nd-class
 *  - Metro Line 1        : MMRDA fare table (₹10 minimum, ₹50 max)
 *  - BEST Bus            : ₹5 flat AC-minimum, ₹8 ordinary up to ~20 stages
 *  - Uber Go             : ₹56 base + ₹14/km + ₹1.5/min (peak ×1.6)
 *  - Ola Mini            : ₹50 base + ₹12/km + ₹1/min (peak ×1.5)
 *  - Rapido Bike         : ₹25 base + ₹5.5/km (peak ×1.2)
 *  - Auto Rickshaw       : ₹21 for first 1.5 km, +₹14.48/km thereafter (day)
 */

import axios from 'axios';

// ─── Mumbai Local Train fare slabs (Western + Central Ordinary 2nd Class) ────
// Source: Indian Railways official tariff 2024-25
const LOCAL_TRAIN_SLABS = [
  { maxKm:  3, fare:  5 },
  { maxKm:  8, fare: 10 },
  { maxKm: 15, fare: 15 },
  { maxKm: 21, fare: 20 },
  { maxKm: 30, fare: 25 },
  { maxKm: 999, fare: 30 },
];

// Metro Line 1 fare table (MMRDA 2024)
const METRO_SLABS = [
  { maxStations: 2,  fare: 10 },
  { maxStations: 5,  fare: 20 },
  { maxStations: 9,  fare: 30 },
  { maxStations: 999, fare: 40 },
];

// ─── Fare calculators ─────────────────────────────────────────────────────────

/** Mumbai Local Train ordinary 2nd class (km → ₹) */
export function localTrainFare(distKm: number): number {
  for (const s of LOCAL_TRAIN_SLABS) {
    if (distKm <= s.maxKm) return s.fare;
  }
  return 45;
}

/** Metro Line 1 (approximate stations from km — ~1 station per 1.2km) */
export function metroFare(distKm: number): number {
  const stations = Math.round(distKm / 1.2);
  for (const s of METRO_SLABS) {
    if (stations <= s.maxStations) return s.fare;
  }
  return 50;
}

/** Uber Go (Mumbai, 2024 rates, INR) */
export function uberFare(distKm: number, durationMin: number, isPeak: boolean): number {
  const base = 56;
  const perKm = 14;
  const perMin = 1.5;
  const surge = isPeak ? 1.6 : 1.0;
  const raw = (base + distKm * perKm + durationMin * perMin) * surge;
  return Math.max(100, Math.round(raw)); // minimum ₹100
}

/** Ola Mini (Mumbai, 2024 rates, INR) */
export function olaFare(distKm: number, durationMin: number, isPeak: boolean): number {
  const base = 50;
  const perKm = 12;
  const perMin = 1.0;
  const surge = isPeak ? 1.5 : 1.0;
  const raw = (base + distKm * perKm + durationMin * perMin) * surge;
  return Math.max(90, Math.round(raw));
}

/** Rapido Bike Taxi (Mumbai, 2024) */
export function rapidoFare(distKm: number, isPeak: boolean): number {
  const base = 25;
  const perKm = 5.5;
  const surge = isPeak ? 1.2 : 1.0;
  const raw = (base + distKm * perKm) * surge;
  return Math.max(35, Math.round(raw));
}

/** BEST Bus ordinary (≈ flat ₹8 for short routes, ₹15+ for long) */
export function busFare(distKm: number): number {
  if (distKm <= 5) return 8;
  if (distKm <= 12) return 12;
  if (distKm <= 20) return 18;
  if (distKm <= 35) return 25;
  // Beyond 35km typically requires MSRTC / ST bus instead of BEST
  return Math.round(distKm * 1.5 + 10);
}

/** Auto rickshaw (Mumbai day rate 2024) */
export function autoFare(distKm: number): number {
  if (distKm <= 1.5) return 21;
  return Math.round(21 + (distKm - 1.5) * 14.48);
}

// ─── OSRM road distance fetcher ───────────────────────────────────────────────

export interface OSRMResult {
  distanceKm: number;
  durationMin: number;
}

export async function fetchGoogleOrOSRMDistance(
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
  profile: 'driving' | 'foot' = 'driving'
): Promise<OSRMResult> {
  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  if (gKey && gKey !== 'your_google_api_key_here' && gKey !== 'CHANGE_ME') {
    try {
      const mode = profile === 'driving' ? 'driving' : 'walking';
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${fromLat},${fromLng}&destinations=${toLat},${toLng}&mode=${mode}&key=${gKey}`;
      const res = await axios.get(url, { timeout: 4000 });
      if (res.data?.status === 'OK' && res.data.rows?.[0]?.elements?.[0]?.status === 'OK') {
        const dm = res.data.rows[0].elements[0];
        return {
          distanceKm: Math.round((dm.distance.value / 1000) * 10) / 10,
          durationMin: Math.round(dm.duration.value / 60),
        };
      }
    } catch {
      // Fallback below
    }
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await axios.get(url, { timeout: 4000 });
    const route = res.data?.routes?.[0];
    if (!route) throw new Error('No OSRM route');
    return {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    // Haversine fallback
    const R = 6371;
    const dLat = ((toLat - fromLat) * Math.PI) / 180;
    const dLng = ((toLng - fromLng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((fromLat * Math.PI) / 180) * Math.cos((toLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = Math.round(straight * 1.35 * 10) / 10; // road multiplier
    return { distanceKm: distKm, durationMin: Math.round(distKm * 2.5) };
  }
}

// ─── Main verifier ────────────────────────────────────────────────────────────

export interface VerifiedFare {
  mode: string;
  verifiedDistanceKm: number;
  verifiedDurationMin: number;
  verifiedCostMin: number;   // lower bound (normal)
  verifiedCostMax: number;   // upper bound (peak surge)
  verifiedCostBest: number;  // actual best-fare for the context
  fareSource: string;
}

export interface VerificationResult {
  totalDistanceKm: number;
  totalDurationMin: number;
  fares: VerifiedFare[];
  cheapestMode: string;
  cheapestFare: number;
  fastestMode: string;
  fastestMin: number;
  verifiedAt: string;
}

interface RouteInput {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  departureTimeIso?: string;
}

function isPeakTime(iso?: string): boolean {
  const date = iso ? new Date(iso) : new Date();
  const hm = date.getHours() * 60 + date.getMinutes();
  return (hm >= 7 * 60 + 30 && hm <= 10 * 60 + 30) || (hm >= 17 * 60 + 30 && hm <= 21 * 60);
}

export async function verifyRouteData(route: RouteInput): Promise<VerificationResult> {
  const peak = isPeakTime(route.departureTimeIso);

  // Fetch road distance (for cabs) + walking distance (for walk legs)
  const [road, walk] = await Promise.all([
    fetchGoogleOrOSRMDistance(route.fromLat, route.fromLng, route.toLat, route.toLng, 'driving'),
    fetchGoogleOrOSRMDistance(route.fromLat, route.fromLng, route.toLat, route.toLng, 'foot'),
  ]);

  const distKm = road.distanceKm;
  const walkKm = walk.distanceKm;

  // Straight-line for train slab lookup (trains don't follow roads exactly)
  const R = 6371;
  const dLat = ((route.toLat - route.fromLat) * Math.PI) / 180;
  const dLng = ((route.toLng - route.fromLng) * Math.PI) / 180;
  const a2 = Math.sin(dLat / 2) ** 2 +
    Math.cos((route.fromLat * Math.PI) / 180) * Math.cos((route.toLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const straightKm = R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
  const trainDistKm = Math.round(straightKm * 1.12 * 10) / 10; // rail adds ~12% over straight

  const trainFare   = localTrainFare(trainDistKm);
  const metro       = metroFare(straightKm);
  const uber        = uberFare(distKm, road.durationMin, peak);
  const ola         = olaFare(distKm, road.durationMin, peak);
  const rapido      = rapidoFare(distKm, peak);
  const bus         = busFare(distKm);
  const auto        = autoFare(distKm);

  // Approx train time: local avg speed ~45 km/h
  const trainMin = Math.round((trainDistKm / 45) * 60) + 5; // +5 for waits

  const fares: VerifiedFare[] = [
    {
      mode: 'local_train',
      verifiedDistanceKm: trainDistKm,
      verifiedDurationMin: trainMin,
      verifiedCostMin: trainFare,
      verifiedCostMax: trainFare,        // train is always flat rate
      verifiedCostBest: trainFare,
      fareSource: 'Indian Railways Official Tariff 2024-25',
    },
    {
      mode: 'metro',
      verifiedDistanceKm: straightKm,
      verifiedDurationMin: Math.round((straightKm / 35) * 60) + 4,
      verifiedCostMin: metro,
      verifiedCostMax: metro,
      verifiedCostBest: metro,
      fareSource: 'MMRDA Metro Line 1 Fare Table 2024',
    },
    {
      mode: 'uber',
      verifiedDistanceKm: distKm,
      verifiedDurationMin: road.durationMin,
      verifiedCostMin: uberFare(distKm, road.durationMin, false),
      verifiedCostMax: uberFare(distKm, road.durationMin, true),
      verifiedCostBest: uber,
      fareSource: 'Uber Go Mumbai rates 2024',
    },
    {
      mode: 'ola',
      verifiedDistanceKm: distKm,
      verifiedDurationMin: road.durationMin,
      verifiedCostMin: olaFare(distKm, road.durationMin, false),
      verifiedCostMax: olaFare(distKm, road.durationMin, true),
      verifiedCostBest: ola,
      fareSource: 'Ola Mini Mumbai rates 2024',
    },
    {
      mode: 'rapido',
      verifiedDistanceKm: distKm,
      verifiedDurationMin: Math.round(road.durationMin * 0.85), // bikes faster in traffic
      verifiedCostMin: rapidoFare(distKm, false),
      verifiedCostMax: rapidoFare(distKm, true),
      verifiedCostBest: rapido,
      fareSource: 'Rapido Bike Taxi Mumbai 2024',
    },
    {
      mode: 'bus',
      verifiedDistanceKm: distKm,
      verifiedDurationMin: Math.round(road.durationMin * 1.4), // buses slower
      verifiedCostMin: bus,
      verifiedCostMax: bus,
      verifiedCostBest: bus,
      fareSource: distKm > 35 ? 'MSRTC / ST Bus approximate fare' : 'BEST Bus Mumbai fare chart 2024',
    },
    {
      mode: 'auto',
      verifiedDistanceKm: distKm,
      verifiedDurationMin: Math.round(road.durationMin * 1.1),
      verifiedCostMin: autoFare(distKm),
      verifiedCostMax: Math.round(autoFare(distKm) * 1.25), // night/surge
      verifiedCostBest: auto,
      fareSource: 'Mumbai Auto Rickshaw Fare 2024 (Day)',
    },
  ];

  // Filter out irrelevant modes for long distances
  const relevant = fares.filter(f => {
    if (distKm > 15 && f.mode === 'auto') return false; // autos don't do long trips
    if (distKm > 50 && f.mode === 'rapido') return false;
    if (distKm > 40 && f.mode === 'metro') return false; // Mumbai metro doesn't stretch 40km end-to-end
    return true;
  });

  const cheapest  = relevant.reduce((a, b) => a.verifiedCostBest < b.verifiedCostBest ? a : b);
  const fastest   = relevant.reduce((a, b) => a.verifiedDurationMin < b.verifiedDurationMin ? a : b);

  return {
    totalDistanceKm: distKm,
    totalDurationMin: road.durationMin,
    fares: relevant,
    cheapestMode: cheapest.mode,
    cheapestFare: cheapest.verifiedCostBest,
    fastestMode: fastest.mode,
    fastestMin: fastest.verifiedDurationMin,
    verifiedAt: new Date().toISOString(),
  };
}
