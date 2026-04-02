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

/**
 * TrustScoreService: Core logic for predicting journey reliability.
 * Calculates a score (0-100) based on historical, real-time, and external factors.
 */
class TrustScoreService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly BASE_SCORE = 75;
  private readonly HALF_LIFE_DAYS = 7;
  private readonly SAFE_THRESHOLD = 80;
  private readonly RISKY_THRESHOLD = 40;

  /**
   * Main entry point to get the trust score for a route.
   */
  public async getTrustScore(
    routeId: string,
    time: Date,
    userId: string
  ): Promise<TrustScoreResponse> {
    const cacheKey = `${routeId}_${userId}_${time.getHours()}_${Math.floor(time.getMinutes() / 5)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // 1. Calculate Individual Factors
    const histPunctuality = await this.calculateHistoricalPunctuality(routeId);
    const realTimeConditions = await this.calculateRealTimeConditions(routeId);
    const externalFactors = await this.calculateExternalFactors(routeId, time);
    const userFactor = await this.calculateUserRatingImpact(userId);

    // 2. Weighted Sum Calculation
    // Punctuality (40%), Real-time (30%), External (30%)
    let trustScore = 
      (histPunctuality * 0.4) + 
      (realTimeConditions * 0.3) + 
      (externalFactors * 0.3);

    // 3. Apply User Rating Impact
    trustScore += userFactor;

    // 4. Clamp & Finalize
    trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));
    
    // 5. Determine Status
    let status: TrustStatus = 'Moderate';
    if (trustScore >= this.SAFE_THRESHOLD) status = 'Safe';
    else if (trustScore <= this.RISKY_THRESHOLD) status = 'Risky';

    // 6. Build Breakdown & Reasoning
    const response: TrustScoreResponse = {
      trustScore,
      status,
      breakdown: {
        historicalPunctuality: Math.round(histPunctuality),
        realTimeConditions: Math.round(realTimeConditions),
        externalFactors: Math.round(externalFactors),
      },
      confidence: this.calculateConfidence(histPunctuality, realTimeConditions),
      reasoning: this.generateReasoning(trustScore, status, histPunctuality, realTimeConditions, externalFactors),
    };

    this.setToCache(cacheKey, response);
    return response;
  }

  /**
   * Weights recent journeys higher using exponential decay (7-day half-life).
   */
  private async calculateHistoricalPunctuality(routeId: string): Promise<number> {
    // MOCK: Fetching last 30 days of journeys
    const mockJourneys = [
      { delay: 0, ageDays: 1 },
      { delay: 5, ageDays: 3 },
      { delay: 15, ageDays: 14 },
    ];

    let totalWeight = 0;
    let weightedScore = 0;

    mockJourneys.forEach(j => {
      const weight = Math.pow(2, -(j.ageDays / this.HALF_LIFE_DAYS));
      // Convert delay to a reliability score (e.g. 0 min = 100, 30 min = 0)
      const reliability = Math.max(0, 100 - (j.delay * 3.33));
      weightedScore += reliability * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedScore / totalWeight : this.BASE_SCORE;
  }

  /**
   * Real-time transit delays and traffic impact.
   */
  private async calculateRealTimeConditions(routeId: string): Promise<number> {
    // MOCK: Integration with Google/Uber/MSRTC APIs
    const currentDelay = 8; // minutes
    return Math.max(0, 100 - (currentDelay * 5));
  }

  /**
   * Weather, Crowd, Events, and Time of Day logic.
   */
  private async calculateExternalFactors(routeId: string, time: Date): Promise<number> {
    let score = this.BASE_SCORE;

    // 1. Weather Impact (MOCK: Rain/Fog)
    const isRaining = false; 
    if (isRaining) score -= 12;

    // 2. Crowd Density (MOCK: High)
    const getCrowdLevel = (): CrowdLevel => 'Moderate';
    const crowdLevel = getCrowdLevel();
    if (crowdLevel === 'Heavy' || crowdLevel === 'Packed') score -= 15;

    // 3. Time of Day Impact (Peak Hours: 8-10 AM, 6-9 PM)
    const hour = time.getHours();
    const isPeak = (hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 21);
    if (isPeak) score -= 10;
    else score += 5;

    // 4. Events (MOCK: Strikes/Accidents)
    const activeDisruptions = false;
    if (activeDisruptions) score -= 30;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * User ratings impact on the personal trust score.
   */
  private async calculateUserRatingImpact(userId: string): Promise<number> {
    // MOCK: Fetch user average rating
    const avgRating = 4.5;
    return (avgRating - 4.0) * 10; // Bonus for high ratings, penalty for low
  }

  private calculateConfidence(hist: number, real: number): number {
    // Simple confidence based on data availability/consistency
    return Math.round((hist + real) / 2);
  }

  private generateReasoning(score: number, status: TrustStatus, hist: number, real: number, ext: number): string {
    if (status === 'Safe') return 'Highly reliable journey; clear weather and optimal transit conditions detected.';
    if (status === 'Risky') return 'High disruption risk due to peak-hour congestion, alerts, or heavy platform crowds.';
    return 'Moderate reliability; expect minor variability in arrival times due to current city traffic.';
  }

  private getFromCache(key: string): TrustScoreResponse | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) return entry.data;
    if (entry) this.cache.delete(key);
    return null;
  }

  private setToCache(key: string, data: TrustScoreResponse) {
    this.cache.set(key, { data, expiry: Date.now() + this.CACHE_TTL });
  }
}

export const trustScoreService = new TrustScoreService();
