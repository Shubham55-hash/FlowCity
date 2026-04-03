import { Router } from 'express';
import { validate, schemas } from './middleware/validationMiddleware';
import { authenticate } from './middleware/authMiddleware';
import { AuthController } from './controllers/authController';
import { JourneyController } from './controllers/journeyController';
import { RescueController } from './controllers/rescueController';
import { WalletController } from './controllers/walletController';
import { ProfileController } from './controllers/profileController';
import { RouteController } from './controllers/routeController';
import { SafetyController, AlertController } from './controllers/safetyController';
import { ghostCommuteController } from './controllers/ghostCommuteController';
import commuteReplayController from './controllers/commuteReplayController';
import mlRoutes from './routes/mlRoutes';

const router = Router();

// ── AUTH ROUTES ──────────────────────────────────────────────────────────────
router.post('/auth/signup', validate(schemas.auth.signup), AuthController.signup);
router.post('/auth/login', validate(schemas.auth.login), AuthController.login);
router.post('/auth/refresh', AuthController.refresh);
router.post('/auth/logout', authenticate as any, AuthController.logout);

// ── JOURNEY PLANNING ROUTES ──────────────────────────────────────────────────
router.post('/journey/plan', validate(schemas.journey.plan), JourneyController.plan);
router.get('/journey/:id', authenticate as any, JourneyController.getActive);
router.post('/journey/:id/update', authenticate as any, JourneyController.updateStatus);

// ── TRUSTSCORE ROUTES ────────────────────────────────────────────────────────
router.get('/route/:id/trustscore', (req, res) => res.json({ score: 92, status: 'Safe', reasoning: 'Optimal transit conditions.' }));
router.get('/route/:id/history', (req, res) => res.json({ history: [{ date: '2026-04-01', score: 85 }, { date: '2026-04-02', score: 90 }] }));

// ── GHOST COMMUTE ROUTES ─────────────────────────────────────────────────────
router.post('/ghost-commute/simulate', ghostCommuteController.simulate);
router.get('/ghost-commute/:id', ghostCommuteController.getQuickSimulation);

// ── HISTORY & ANALYTICS ──────────────────────────────────────────────────────
router.get('/history/stats', commuteReplayController.getStats);
router.get('/history/insights', commuteReplayController.getRecommendations);
router.get('/history/replay/:id', commuteReplayController.getReplay);

// ── RESCUE MODE ROUTES (open for local demo; protect in production) ──────────
router.post('/rescue/alternatives', RescueController.getAlternatives);
router.post('/rescue/switch', RescueController.switchRoute);
router.post('/rescue/trigger-test', RescueController.triggerTest);

// ── ROUTES DISCOVERY ─────────────────────────────────────────────────────────
router.get('/routes/all', RouteController.getAll);
router.get('/routes/nearby', RouteController.getNearby);
router.get('/routes/:from/:to', RouteController.getSpecific);
router.get('/geocode/autocomplete', RouteController.autocomplete);

// ── SAFETY & HEATMAP ROUTES ──────────────────────────────────────────────────
router.get('/safety/heatmap', SafetyController.getHeatmap);
router.post('/safety/path', SafetyController.evaluatePath);
router.post('/safety/report', authenticate as any, SafetyController.reportIncident);

// ── ALERTS ROUTES ────────────────────────────────────────────────────────────
router.get('/alerts', authenticate as any, AlertController.getActive);
router.post('/alerts/:id/dismiss', authenticate as any, AlertController.dismiss);

// ── PROFILE ROUTES ───────────────────────────────────────────────────────────
router.get('/profile', authenticate as any, ProfileController.get);
router.put('/profile', authenticate as any, ProfileController.update);
router.get('/profile/journeys', authenticate as any, ProfileController.getJourneys);
router.get('/profile/stats', authenticate as any, ProfileController.getStats);

// ── WALLET ROUTES ────────────────────────────────────────────────────────────
router.get('/wallet/balance', authenticate as any, WalletController.getBalance);
router.post('/wallet/topup', authenticate as any, validate(schemas.wallet.topup), WalletController.topup);
router.post('/wallet/autorecharge/toggle', authenticate as any, WalletController.toggleAutoRecharge);
router.get('/wallet/transactions', authenticate as any, WalletController.getTransactions);

// ── ML Intelligence Routes ───────────────────────────────────────────────────
router.use('/ml', mlRoutes);

export default router;
