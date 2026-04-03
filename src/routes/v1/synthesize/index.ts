import { Router } from 'express';
import { synthesize } from '@/routes/v1/synthesize/synthesize.controller';

const synthesizeRouter = Router();

synthesizeRouter.get('/', synthesize);

export default synthesizeRouter;
