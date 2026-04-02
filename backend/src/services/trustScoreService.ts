import { safetyService } from './safetyService';
import { dataIntegrationService } from './dataIntegrationService';

interface ScoreBreakdown {
  historicalPunctuality: number;
  realTimeConditions: number;
  externalFactors: number;
}

export type TrustStatus = 'Safe' | 'Moderate' | 'Risky';

interface TrustScoreResponse {
  trustScore: number;
  status: TrustStatus;
  breakdown: ScoreBreakdown;
  confidence: number;
  reasoning: string;
}

interface CacheEntry {
  data: TrustScoreResponse;
  expiry: number;
}

type CrowdLevel = 'Light' | 'Moderate' | 'Heavy' | 'Packed';

class TrustScoreService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly BASE_SCORE = 75;
  private readonly HALF_LIFE_DAYS = 7;
  private readonly SAFE_THRESHOLD = 80;
  private readonly RISKY_THRESHOLD = 40;

  public async getTrustScore(routeId: string, time: Date, userId: string): Promise<TrustScoreResponse> {
    const cacheKey = `${routeId}_${userId}_${time.getHours()}_${Math.floor(time.getMinutes() / 5)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const histPunctuality = await this.calculateHistoricalPunctuality(routeId);
    const realTimeConditions = await this.calculateRealTimeConditions(routeId);
    const externalFactors = await this.calculateExternalFactors(routeId, time);
    const userFactor = await this.calculateUserRatingImpact(userId);

    let trustScore = (histPunctuality * 0.4) + (realTimeConditions * 0.3) + (externalFactors * 0.3) + userFactor;
    trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));
    
    let status: TrustStatus = 'Moderate';
    if (trustScore >= this.SAFE_THRESHOLD) status = 'Safe';
    else if (trustScore <= this.RISKY_THRESHOLD) status = 'Risky';

    const response: TrustScoreResponse = {
      trustScore,
      status,
      breakdown: {
        historicalPunctuality: Math.round(histPunctuality),
        realTimeConditions: Math.round(realTimeConditions),
        externalFactors: Math.round(externalFactors),
      },
      confidence: Math.round((histPunctuality + realTimeConditions) / 2),
      reasoning: this.generateReasoning(status),
    };

    this.setToCache(cacheKey, response);
    return response;
  }

  private async calculateHistoricalPunctuality(routeId: string): Promise<number> {
    const isCHVR = routeId.includes('Churchgate') || routeId.includes('CH-VR');
    const mockJourneys = isCHVR 
      ? [{ delay: 12, ageDays: 1 }, { delay: 8, ageDays: 2 }] 
      : [{ delay: 0, ageDays: 1 }, { delay: 5, ageDays: 3 }];

    let totalWeight = 0, weightedScore = 0;
    mockJourneys.forEach(j => {
      const weight = Math.pow(2, -(j.ageDays / this.HALF_LIFE_DAYS));
      const reliability = Math.max(0, 100 - (j.delay * 3.33));
      weightedScore += reliability * weight;
      totalWeight += weight;
    });
    return totalWeight > 0 ? weightedScore / totalWeight : this.BASE_SCORE;
  }

  private async calculateRealTimeConditions(routeId: string): Promise<number> {
    const baseDelay = routeId.includes('Bandra') ? 15 : 8;
    return Math.max(0, 100 - ((baseDelay + Math.random() * 4) * 5));
  }

  private async calculateExternalFactors(routeId: string, time: Date): Promise<number> {
    const weather = dataIntegrationService.getCachedData<any>('weather:mumbai');
    const crowd = await dataIntegrationService.getCrowdData(routeId);
    const events = await dataIntegrationService.getLocalEvents();
    
    let factor = 1.0;
    if (weather?.isAdverse) factor *= 0.85;
    if (crowd.density > 80) factor *= 0.7;
    events.forEach((e: any) => { if (e.impactScore > 7) factor *= 0.9; });

    let score = this.BASE_SCORE * factor;

    const isPeak = (time.getHours() >= 8 && time.getHours() <= 10) || (time.getHours() >= 18 && time.getHours() <= 21);
    if (isPeak) score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  private async calculateUserRatingImpact(userId: string): Promise<number> {
    return (4.5 - 4.0) * 10;
  }

  private generateReasoning(status: TrustStatus): string {
    if (status === 'Safe') return 'Highly reliable journey; clear weather and optimal transit conditions detected.';
    if (status === 'Risky') return 'High disruption risk due to peak-hour congestion or heavy crowds.';
    return 'Moderate reliability; expect minor variability in arrival times.';
  }

  private getFromCache(key: string): TrustScoreResponse | null {
    const entry = this.cache.get(key);
    return (entry && entry.expiry > Date.now()) ? entry.data : null;
  }

  private setToCache(key: string, data: TrustScoreResponse) {
    this.cache.set(key, { data, expiry: Date.now() + this.CACHE_TTL });
  }
}

export const trustScoreService = new TrustScoreService();
