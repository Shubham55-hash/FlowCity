import stationsData from '../data/mumbaiStations.json';

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
