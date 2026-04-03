
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
  private transitQueue!: Queue.Queue;
  private weatherQueue!: Queue.Queue;

 constructor() {
  super();
  
  try {
    const redisOptions = { redis: { port: 6379, host: '127.0.0.1' } };
    this.transitQueue = new Queue('transit-polling', redisOptions);
    this.weatherQueue = new Queue('weather-polling', redisOptions);
    this.initializeQueues();
  } catch (err) {
    console.warn('⚠️ Redis not available — running without background polling');
  }
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
      const apiKey = process.env.IRCTC_API_KEY;
      const baseUrl = process.env.IRCTC_API_BASE_URL || 'https://irctc1.p.rapidapi.com';
      const apiHost = process.env.IRCTC_API_HOST || 'irctc1.p.rapidapi.com';
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

      if (apiKey && apiKey !== 'your_irctc_api_key_here') {
        const resp = await axios.get(`${baseUrl}/api/v3/trainsList`, {
          params: { fromStationCode: 'CSTM', toStationCode: 'DDR', dateOfJourney: today, classType: 'SL', quota: 'GN' },
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': apiHost
          }
        });
        
        const transit: TransitInfo = {
          routeId: 'VR-DDR-1',
          delayMin: resp.data?.delay || 0,
          status: (resp.data?.delay || 0) > 15 ? 'Delayed' : 'Normal',
          source: 'IRCTC-RT',
          lastUpdated: Date.now()
        };
        this.cacheData('transit:VR-DDR-1', transit, 60000);
        this.emit('dataUpdated', { type: 'transit', data: transit });
      } else {
        // Fallback for missing key
        const mockTransit: TransitInfo = {
          routeId: 'VR-DDR-1',
          delayMin: Math.floor(Math.random() * 5),
          status: 'Normal',
          source: 'System-Mock',
          lastUpdated: Date.now()
        };
        this.cacheData('transit:VR-DDR-1', mockTransit, 60000);
      }
    } catch (err) {
      console.error('Transit Polling Error:', err);
    }
  }

  private async pollWeatherData() {
    try {
      const enableWeather = process.env.ENABLE_WEATHER === 'true';
      if (!enableWeather) return;

      // Using Open-Meteo (Free, No-Key) for Mumbai
      const resp = await axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: 19.0760,
          longitude: 72.8777,
          current_weather: true
        }
      });

      const current = resp.data.current_weather;
      const isAdverse = current.weathercode > 50; // Simple heuristic (Rain/Storm)
      
      const weather: WeatherInfo = { 
        temp: current.temperature, 
        condition: `Code: ${current.weathercode}`, 
        isAdverse, 
        delayImpact: isAdverse ? 15 : 0, 
        lastUpdated: Date.now() 
      };

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
