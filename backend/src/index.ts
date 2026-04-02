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

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
socketService.init(httpServer);

// Middleware
app.use(cors());
app.use(express.json());
app.use(apiRateLimiter);

// ── CONSOLIDATED MASTER ROUTES (30+ Endpoints) ──────────────────────────────
app.use('/api', router);

// Root & Health Check
app.get('/', (req, res) => {
  res.send('<h1>FlowCity API</h1><p>The backend is running. Go to <a href="http://localhost:3000">localhost:3000</a> for the main app.</p>');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start Server
httpServer.listen(PORT, () => {
  console.log(`🚀 FlowCity Backend running on port ${PORT}`);
  console.log(`🔗 Master API:         http://localhost:${PORT}/api`);
  console.log(`🔌 WebSockets:         ws://localhost:${PORT}`);
});
