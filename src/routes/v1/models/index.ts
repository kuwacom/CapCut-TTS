import { Router } from 'express';
import { listModels } from '@/routes/v1/models/models.controller';

const modelsRouter = Router();

modelsRouter.get('/', listModels);

export default modelsRouter;
