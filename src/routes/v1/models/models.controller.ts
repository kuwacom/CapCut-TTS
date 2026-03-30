import type { Request, Response } from 'express';
import capCutService from '@/services/CapCutService';
import logger from '@/services/logger';

/**
 * 利用可能な音声モデル一覧を返す
 */
export const listModels = async (_req: Request, res: Response) => {
  try {
    const models = await capCutService.listModels();
    res.status(200).json({ data: models });
  } catch (error) {
    logger.error('Failed to fetch CapCut voice models', error);
    res.status(502).json({ error: 'Failed to fetch CapCut voice models' });
  }
};
