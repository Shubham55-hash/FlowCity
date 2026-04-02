
import axios from 'axios';
import Queue from 'bull';
import EventEmitter from 'events';

// ──────────────── Types & Interfaces ──────────────────────────────────────────

export interface WeatherInfo {
  temp: number;
  condition: string;
  isAdverse: boolean;
  delayImpact: number;
  lastUpdated: number;
}

export interface TransitInfo {
  routeId: string;
  delayMin: number;
  status: 'Normal' | 'Delayed' | 'Critical';
  source: string;
  lastUpdated: number;
}

export interface CrowdInfo {
  location: string;
  density: number; // 0-100
  trend: 'Rising' | 'Falling' | 'Stable';
  lastUpdated: number;
}

export interface EventInfo {
  id: string;
  title: string;
  startTime: number;
  impactRadiusKm: number;
  impactScore: number; // 0-10
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// ──────────────── DataIntegrationService ──────────────────────────────────────

class DataIntegrationService extends EventEmitter {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 300000; // 5 minutes
  
  // Bull Queues
  private transitQueue: Queue.Queue;
  private weatherQueue: Queue.Queue;

  constructor() {
    super();
    
    // Initialize Bull (using localhost Redis or sandbox)
    const redisOptions = { redis: { port: 6379, host: '127.0.0.1' } };
    this.transitQueue = new Queue('transit-polling', redisOptions);
    this.weatherQueue = new Queue('weather-polling', redisOptions);

    this.initializeQueues();
  }

  private initializeQueues() {
    // 30-second GTFS Polling
    this.transitQueue.process(async (job) => this.pollTransitData());
    this.transitQueue.add({}, { repeat: { cron: '*/30 * * * * *' } });

    // 15-minute Weather Polling
    this.weatherQueue.process(async (job) => this.pollWeatherData());
    this.weatherQueue.add({}, { repeat: { cron: '*/15 * * * *' } });

    console.log('🚀 Data Integration Pipeline Initialized (Async Pollers Active)');
  }

  // ── Pollers ───────────────────────────────────────────────────────────────

  private async pollTransitData() {
    try {
      // 1. Fetch GTFS-RT Protobuf (BEST Bus)
      // 2. Fetch IRCTC Status (RapidAPI)
      // 3. Normalize & Update Cache
      const mockTransit: TransitInfo = {
        routeId: 'VR-DDR-1',
        delayMin: Math.floor(Math.random() * 15),
        status: 'Normal',
        source: 'GTFS-RT',
        lastUpdated: Date.now()
      };

      this.cacheData('transit:VR-DDR-1', mockTransit, 60000);
      this.emit('dataUpdated', { type: 'transit', data: mockTransit });
    } catch (err) {
      console.error('Transit Polling Error:', err);
    }
  }

  private async pollWeatherData() {
    try {
      const apiKey = process.env.OPENWEATHERMAP_API_KEY;
      let weather: WeatherInfo;

      if (apiKey) {
        const resp = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Mumbai&appid=${apiKey}`);
        weather = this.normalizeWeather(resp.data);
      } else {
        weather = { 
          temp: 28, condition: 'Clear', isAdverse: false, 
          delayImpact: 0, lastUpdated: Date.now() 
        };
      }

      this.cacheData('weather:mumbai', weather, 900000);
      this.emit('dataUpdated', { type: 'weather', data: weather });
    } catch (err) {
      console.error('Weather Polling Error:', err);
    }
  }

  // ── Core Methods ───────────────────────────────────────────────────────────

  public cacheData(key: string, data: any, ttl?: number) {
    const expiry = Date.now() + (ttl || this.DEFAULT_TTL);
    this.cache.set(key, { data, expiry });
  }

  public getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  public async getCrowdData(location: string): Promise<CrowdInfo> {
    const key = `crowd:${location}`;
    const cached = this.getCachedData<CrowdInfo>(key);
    if (cached) return cached;

    // In-Memory fallback / Telco integration logic
    const mockCrowd: CrowdInfo = {
      location,
      density: Math.floor(Math.random() * 100),
      trend: 'Stable',
      lastUpdated: Date.now()
    };
    this.cacheData(key, mockCrowd, 60000);
    return mockCrowd;
  }

  public async getLocalEvents(): Promise<EventInfo[]> {
    // Sports / Concerts Simulation (Ticketmaster Hook)
    return [
      { id: 'E1', title: 'IPL Match: MI vs CSK', startTime: Date.now() + 3600000, impactRadiusKm: 3, impactScore: 8 },
      { id: 'E2', title: 'Public Holiday (Diwali)', startTime: Date.now(), impactRadiusKm: 20, impactScore: 5 }
    ];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private normalizeWeather(raw: any): WeatherInfo {
    const isAdverse = raw.weather[0].main !== 'Clear' && raw.weather[0].main !== 'Clouds';
    return {
      temp: raw.main.temp - 273.15,
      condition: raw.weather[0].description,
      isAdverse,
      delayImpact: isAdverse ? 15 : 0,
      lastUpdated: Date.now()
    };
  }

  public validateData(type: string, data: any): boolean {
    if (!data) return false;
    const staleness = Date.now() - data.lastUpdated;
    return staleness < 3600000; // Alert if stale > 1 hour
  }
}

export const dataIntegrationService = new DataIntegrationService();
