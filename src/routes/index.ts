import { Router } from 'express';
import v1Router from '@/routes/v1';

/**
 * ルートルーター
 */
const router = Router();

router.use('/v1', v1Router);
router.use((req, res) => {
  res.status(404).end();
});

export default router;
