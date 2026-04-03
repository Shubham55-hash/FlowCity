import { Router } from 'express';
import { ghostCommuteController } from '../controllers/ghostCommuteController';
import { validateRequest, ghostCommuteSchema, ghostCommuteQuerySchema } from '../middleware/validator';

const router = Router();

/**
 * @route   GET /api/ghost-commute
 * @desc    Quick simulation via query params
 */
router.get(
  '/',
  validateRequest(ghostCommuteQuerySchema),
  ghostCommuteController.getQuickSimulation
);

/**
 * @route   POST /api/ghost-commute
 * @desc    Full journey simulation with multi-leg support
 */
router.post(
  '/',
  validateRequest(ghostCommuteSchema),
  ghostCommuteController.simulate
);

/**
 * @route   GET /api/ghost-commute/cache
 * @desc    Get cache statistics
 */
router.get('/cache', ghostCommuteController.getCacheStats);

/**
 * @route   DELETE /api/ghost-commute/cache/:routeKey
 * @desc    Invalidate a specific route cache
 */
router.delete('/cache/:routeKey', ghostCommuteController.invalidateCache);

router.post('/trigger-disruption', ghostCommuteController.triggerDisruption);

export default router;
