
import { Coordinates } from './geocoderService';

interface GridCell {
  id: string;
  lat: number;
  lng: number;
  crowdDensity: number; // 0-100
  safetyScore: number;  // 0-100
  lastUpdated: number;
}

interface IncidentReport {
  id: string;
  lat: number;
  lng: number;
  type: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}

class SafetyService {
  private gridCache: Map<string, GridCell> = new Map();
  private reports: IncidentReport[] = [];
  private readonly GRID_SIZE = 0.001; // Approx 100m in lat/lng

  constructor() {
    // Initialize some dummy hotspots for Mumbai
    this.seedMockData();
  }

  private seedMockData() {
    // Mumbai Station hotspots (High crowd, varying safety)
    const hotspots = [
      { lat: 19.2291, lng: 72.8574, type: 'Borivali', crowd: 85, safety: 90 },
      { lat: 19.1197, lng: 72.8468, type: 'Andheri', crowd: 92, safety: 85 },
      { lat: 19.0178, lng: 72.8478, type: 'Dadar', crowd: 98, safety: 80 },
      { lat: 18.9400, lng: 72.8353, type: 'CSMT', crowd: 95, safety: 95 },
      { lat: 19.0522, lng: 72.8414, type: 'Bandra', crowd: 88, safety: 88 },
    ];

    hotspots.forEach(pool => {
      this.addReport({
        id: `seed-${pool.type}`,
        lat: pool.lat,
        lng: pool.lng,
        type: 'General Crowd',
        severity: 'low',
        timestamp: Date.now()
      });
    });
  }

  public async generateHeatmap(center: Coordinates, radiusKm: number): Promise<any> {
    const cells: any[] = [];
    const step = this.GRID_SIZE;
    
    // Create a grid around the center
    const range = (radiusKm / 111); // Convert KM to degrees approx
    
    for (let lat = center.lat - range; lat <= center.lat + range; lat += step) {
      for (let lng = center.lng - range; lng <= center.lng + range; lng += step) {
        const cell = this.calculateCellStats(lat, lng);
        cells.push({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [lng, lat],
              [lng + step, lat],
              [lng + step, lat + step],
              [lng, lat + step],
              [lng, lat]
            ]]
          },
          properties: cell
        });
      }
    }

    return {
      type: "FeatureCollection",
      features: cells,
      lastUpdated: Date.now()
    };
  }

  private calculateCellStats(lat: number, lng: number): GridCell {
    const id = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    
    // Check cache (5 min TTL for heatmap)
    const cached = this.gridCache.get(id);
    if (cached && (Date.now() - cached.lastUpdated < 300000)) {
      return cached;
    }

    // Heuristics for Mumbai patterns
    const hour = new Date().getHours();
    const isPeak = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21);
    
    // Location-stable variation (same cell + hour → same score; no Math.random flicker)
    const seed = Math.sin(lat * 12.9898 + lng * 78.233 + hour) * 43758.5453;
    const frac = seed - Math.floor(seed);
    const wobble = (n: number) => frac * n;

    let crowd = isPeak ? 65 + wobble(20) : 20 + wobble(30);
    let safety = 78 + wobble(18);

    // Adjust based on nearby reports
    const nearbyReports = this.reports.filter(r => 
      Math.abs(r.lat - lat) < 0.005 && Math.abs(r.lng - lng) < 0.005
    );

    nearbyReports.forEach(r => {
      if (r.severity === 'high') safety -= 20;
      if (r.severity === 'medium') safety -= 10;
      crowd += 5;
    });

    const cell: GridCell = {
      id,
      lat,
      lng,
      crowdDensity: Math.min(100, crowd),
      safetyScore: Math.max(0, safety),
      lastUpdated: Date.now()
    };

    this.gridCache.set(id, cell);
    return cell;
  }

  public async evaluatePathSafety(path: Coordinates[]): Promise<any> {
    let totalSafety = 0;
    const dangerousSegments: any[] = [];

    path.forEach((point, i) => {
      const stats = this.calculateCellStats(point.lat, point.lng);
      totalSafety += stats.safetyScore;
      
      if (stats.safetyScore < 40) {
        dangerousSegments.push({
          index: i,
          location: point,
          score: stats.safetyScore
        });
      }
    });

    return {
      safetyRating: totalSafety / path.length,
      dangerousSegments,
      status: dangerousSegments.length > 0 ? 'caution' : 'optimal'
    };
  }

  public crowdPrediction(lat: number, lng: number, time: Date): number {
    const hour = time.getHours();
    const day = time.getDay(); // 0 is Sunday
    
    // Mumbai local train patterns
    let baseCrowd = 30;
    
    // Morning Rush
    if (hour >= 8 && hour <= 10) baseCrowd = 90;
    // Evening Rush
    else if (hour >= 17 && hour <= 20) baseCrowd = 95;
    // Night
    else if (hour >= 23 || hour <= 5) baseCrowd = 5;
    
    // Weekend reduction
    if (day === 0 || day === 6) baseCrowd *= 0.6;

    return Math.floor(baseCrowd + (Math.random() * 10 - 5));
  }

  public addReport(report: any) {
    this.reports.push({
      ...report,
      id: `REP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now()
    });
  }
}

export const safetyService = new SafetyService();
