import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { trustScoreService } from './services/trustScoreService';
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

// Error handling
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 FlowCity Backend running on port ${PORT}`);
  console.log(`🔗 Trust Score API: http://localhost:${PORT}/api/trust-score`);
});
