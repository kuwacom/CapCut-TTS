import { Router } from 'express';
import { fallback } from '@/routes/v2/fallback';
import speakersRouter from '@/routes/v2/speakers';
import synthesizeRouter from '@/routes/v2/synthesize';

const v2Router = Router();

v2Router.use('/speakers', speakersRouter);
v2Router.use('/synthesize', synthesizeRouter);
v2Router.use(fallback);

export default v2Router;
