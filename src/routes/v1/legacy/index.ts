import { Router } from 'express';
import { synthesizeLegacy } from '@/routes/v1/legacy/legacy.controller';

const legacyRouter = Router();

legacyRouter.get('/synthesize', synthesizeLegacy);

export default legacyRouter;
