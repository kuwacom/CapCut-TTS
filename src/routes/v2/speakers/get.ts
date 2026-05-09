import type { Request, Response } from 'express';
import { apiError, ErrorCode } from '@/lib/apiError';
import capCutService from '@/services/CapCutService';
import logger from '@/services/logger';

/**
 * ### get
 * `/v2/speakers` を処理する
 *
 * @param req - Express リクエスト
 * @param res - Express レスポンス
 */
export const get = async (req: Request, res: Response): Promise<void> => {
  void req;

  try {
    const speakers = await capCutService.listSpeakers();
    res.status(200).json(speakers);
  } catch (error) {
    logger.error('Failed to fetch CapCut speakers', error);
    throw apiError(ErrorCode.BAD_GATEWAY, 'Failed to fetch CapCut speakers');
  }
};