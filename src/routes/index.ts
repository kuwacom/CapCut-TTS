import { Router } from 'express';
import legacyRouter from '@/routes/v1/legacy';
import v1Router from '@/routes/v1';

/**
 * ルートルーター
 */
const router = Router();

router.use('/v1', v1Router);
router.use('/legacy', legacyRouter);
router.use((req, res) => {
  res.status(404).end();
});

export default router;
