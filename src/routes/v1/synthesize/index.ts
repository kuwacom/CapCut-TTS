import { Router } from 'express';
import { synthesize } from './synthesize.controller';

const synthesizeRouter = Router();

synthesizeRouter.get('/', synthesize);

export default synthesizeRouter;
