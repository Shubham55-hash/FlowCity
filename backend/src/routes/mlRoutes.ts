
import { Router } from 'express';
import { mlService } from '../services/mlService';

const router = Router();

router.get('/predict-delay', async (req, res) => {
  const routeId = (req.query.routeId as string) || 'default';
  const time = req.query.time ? new Date(req.query.time as string) : new Date();
  
  const prediction = await mlService.predictDelay(routeId, time);
  res.json(prediction);
});

router.get('/metrics', (req, res) => {
  res.json(mlService.getPerformanceMetrics());
});

export default router;
