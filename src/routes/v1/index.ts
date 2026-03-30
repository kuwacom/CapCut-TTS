import { Router } from 'express';
import synthesizeRouter from './synthesize';

const v1Router = Router();

v1Router.use('/synthesize', synthesizeRouter);

v1Router.use((req, res) => {
  res.status(404).end();
});

export default v1Router;
