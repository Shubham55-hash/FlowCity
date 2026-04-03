import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { socketService } from './services/socketService';
import { trustScoreService } from './services/trustScoreService';
import { safetyService } from './services/safetyService';
import router from './routes';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

// ── CORS: driven by ALLOWED_ORIGINS env var ──────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
socketService.init(httpServer);

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Pre-flight for all routes
app.use(express.json());
app.use(apiRateLimiter);

// ── CONSOLIDATED MASTER ROUTES (30+ Endpoints) ──────────────────────────────
app.use('/api', router);

// Root
app.get('/', (_req, res) => {
  res.json({ service: 'FlowCity API', version: process.env.npm_package_version || '1.0.0' });
});

// ── Detailed Health Check ────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, string> = {};

  // DB ping
  try {
    const { query } = await import('./db/index.js');
    await query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    checks,
  });
});

// ── Prometheus Metrics stub (replace body with prom-client when ready) ────────
app.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(
    `# HELP flowcity_up Whether the FlowCity backend is running
# TYPE flowcity_up gauge
flowcity_up 1
# HELP flowcity_uptime_seconds Process uptime in seconds
# TYPE flowcity_uptime_seconds counter
flowcity_uptime_seconds ${Math.round(process.uptime())}
`
  );
});

// Error handling
app.use(errorHandler);

// Start Server
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 FlowCity Backend running on port ${PORT}`);
  console.log(`🔗 Master API:         http://localhost:${PORT}/api`);
  console.log(`🔌 WebSockets:         ws://localhost:${PORT}`);
});
