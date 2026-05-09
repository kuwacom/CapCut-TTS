import { Router } from 'express';
import { get } from './get';

const speakersRouter = Router();

speakersRouter.get('/', get);

export default speakersRouter;