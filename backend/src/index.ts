import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { trustScoreService } from './services/trustScoreService';
import { ghostCommuteService } from './services/ghostCommuteService';
import type { SimulateJourneyInput } from './services/ghostCommuteService';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(apiRateLimiter);

// Routes
app.get('/', (req, res) => {
  res.send('<h1>FlowCity API</h1><p>The backend is running. Go to <a href="http://localhost:3000">localhost:3000</a> for the main app.</p>');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * GET /api/trust-score
 * Calculates the trust score for a journey.
 * In a real scenario, this would take routeId/userId as query params.
 */
app.get('/api/trust-score', async (req, res) => {
  try {
    const routeId = (req.query.routeId as string) || 'Bandra-Worli-Sea-Link';
    const userId = (req.query.userId as string) || 'citizen-4829';
    const time = new Date();

    const scoreData = await trustScoreService.getTrustScore(routeId, time, userId);
    
    // Simulate real-time variability for the demo if requested
    if (req.query.simulate === 'true') {
        scoreData.trustScore = Math.max(0, Math.min(100, scoreData.trustScore + (Math.random() * 10 - 5)));
    }

    res.json(scoreData);
  } catch (error) {
    console.error('Trust Score Error:', error);
    res.status(500).json({ error: 'Failed to calculate trust score' });
  }
});

/**
 * GET /api/ghost-commute
 * Browser-friendly version — accepts query params.
 * ?start=Andheri&startLat=19.1197&startLng=72.8468
 * &end=Churchgate&endLat=18.9353&endLng=72.8258
 * &departureTime=2026-04-03T08:15:00%2B05:30   (optional, defaults to now)
 * &priority=time                                 (cost | safety | time)
 */
app.get('/api/ghost-commute', async (req, res) => {
  try {
    const q = req.query as Record<string, string>;

    const startLocation = {
      name: q.start ?? 'Andheri',
      lat:  parseFloat(q.startLat ?? '19.1197'),
      lng:  parseFloat(q.startLng ?? '72.8468'),
    };
    const endLocation = {
      name: q.end ?? 'Churchgate',
      lat:  parseFloat(q.endLat ?? '18.9353'),
      lng:  parseFloat(q.endLng ?? '72.8258'),
    };
    const departureTime = q.departureTime ? new Date(q.departureTime) : new Date();
    const preferences = {
      priority: (['cost', 'safety', 'time'].includes(q.priority) ? q.priority : 'time') as 'cost' | 'safety' | 'time',
      avoidCrowds: q.avoidCrowds === 'true',
    };

    if (isNaN(departureTime.getTime())) {
      return res.status(400).json({ error: 'departureTime must be a valid ISO 8601 date string' });
    }

    const result = await ghostCommuteService.simulateJourney(
      startLocation, endLocation, departureTime, preferences
    );
    res.json(result);
  } catch (error) {
    console.error('Ghost Commute Error:', error);
    res.status(500).json({ error: 'Failed to simulate journey' });
  }
});

/**
 * POST /api/ghost-commute
 * Simulates a multi-leg journey with ML-style delay predictions.
 *
 * Body: { startLocation, endLocation, departureTime, preferences }
 * startLocation / endLocation: { name: string, lat: number, lng: number }
 * departureTime: ISO 8601 string
 * preferences: { priority: 'cost'|'safety'|'time', avoidCrowds?: boolean, maxWalkMinutes?: number }
 */
app.post('/api/ghost-commute', async (req, res) => {
  try {
    const body = req.body as Partial<SimulateJourneyInput & { departureTime: string }>;

    if (!body.startLocation || !body.endLocation) {
      return res.status(400).json({ error: 'startLocation and endLocation are required' });
    }

    const startLocation = body.startLocation;
    const endLocation = body.endLocation;
    const departureTime = body.departureTime ? new Date(body.departureTime) : new Date();
    const preferences = body.preferences ?? { priority: 'time' };

    if (isNaN(departureTime.getTime())) {
      return res.status(400).json({ error: 'departureTime must be a valid ISO 8601 date string' });
    }

    const result = await ghostCommuteService.simulateJourney(
      startLocation,
      endLocation,
      departureTime,
      preferences
    );

    res.json(result);
  } catch (error) {
    console.error('Ghost Commute Error:', error);
    res.status(500).json({ error: 'Failed to simulate journey' });
  }
});

/**
 * GET /api/ghost-commute/cache
 * Returns current cache stats (size + active route keys).
 */
app.get('/api/ghost-commute/cache', (_req, res) => {
  res.json(ghostCommuteService.getCacheStats());
});

/**
 * DELETE /api/ghost-commute/cache/:routeKey
 * Manually invalidate a cached route (e.g. on a disruption alert).
 */
app.delete('/api/ghost-commute/cache/:routeKey', (req, res) => {
  const removed = ghostCommuteService.invalidateRoute(req.params.routeKey);
  res.json({ removed, routeKey: req.params.routeKey });
});

// Error handling
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 FlowCity Backend running on port ${PORT}`);
  console.log(`🔗 Trust Score API:    http://localhost:${PORT}/api/trust-score`);
  console.log(`👻 Ghost Commute API:  http://localhost:${PORT}/api/ghost-commute  [POST]`);
});
