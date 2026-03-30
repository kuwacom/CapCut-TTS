import { Router } from 'express';
import v1Router from './v1';

const router = Router();

router.use('/v1', v1Router);
router.use((req, res) => {
  res.status(404).end();
});

export default router;
