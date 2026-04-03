import stationsData from '../data/mumbaiStations.json';
import { STATION_LATLNG } from '../data/stationLatLng';

export interface StationInfo {
  name: string;
  code: string;
  line: string;
}

class StationResolver {
  private stations: StationInfo[] = stationsData;
  private cache: Map<string, string> = new Map();

  constructor() {
    // Pre-populate cache with exact lowercase names
    this.stations.forEach(s => {
      this.cache.set(s.name.toLowerCase(), s.code);
    });
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Nearest known Mumbai station by road distance (for POIs / colleges not in the roster). */
  public nearestStation(lat: number, lng: number): StationInfo | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let best: { info: StationInfo; d: number } | null = null;
    for (const s of this.stations) {
      const c = STATION_LATLNG[s.name];
      if (!c) continue;
      const d = this.haversineKm(lat, lng, c.lat, c.lng);
      if (!best || d < best.d) best = { info: s, d };
    }
    return best?.info ?? null;
  }

   public resolve(name: string): string | null {
    const info = this.getStationInfo(name);
    return info ? info.code : null;
  }

  public getStationInfo(name: string): StationInfo | null {
    if (!name) return null;
    
    const normalized = name.toLowerCase()
      .replace(/ station| stn/g, '')
      .replace(/ west| east| central| junction/g, '')
      .trim();

    // 1. Direct match
    const exactMatch = this.stations.find(s => s.name.toLowerCase() === normalized);
    if (exactMatch) return exactMatch;

    // 2. Fuzzy/Partial match
    const fuzzyMatch = this.stations.find(s => {
      const sName = s.name.toLowerCase();
      return sName.includes(normalized) || normalized.includes(sName);
    });

    if (fuzzyMatch) return fuzzyMatch;

    // 3. Special cases
    if (normalized === 'cst' || normalized === 'vt' || normalized === 'csmt') return { name: 'CSMT', code: 'CSMT', line: 'Central' };
    
    return null;
  }

  public getAllStations(): StationInfo[] {
    return this.stations;
  }
}

export const stationResolver = new StationResolver();
