import { Router } from 'express';
import modelsRouter from '@/routes/v1/models';
import synthesizeRouter from '@/routes/v1/synthesize';

/**
 * v1 API ルーター
 */
const v1Router = Router();

v1Router.use('/models', modelsRouter);
v1Router.use('/synthesize', synthesizeRouter);

v1Router.use((req, res) => {
  res.status(404).end();
});

export default v1Router;
