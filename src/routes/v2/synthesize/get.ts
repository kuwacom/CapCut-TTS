import type { NextFunction, Request, Response } from 'express';
import {
  sendAudioBufferResponse,
  sendAudioStreamResponse,
} from '@/lib/audioResponse';
import { apiError, ErrorCode } from '@/lib/apiError';
import { SynthesizeQuerySchema } from '@/schemas/synthesize';
import capCutService from '@/services/CapCutService';
import logger from '@/services/logger';

/**
 * ### get
 * `/v2/synthesize` を処理する
 *
 * @param req - Express リクエスト
 * @param res - Express レスポンス
 * @param next - NextFunction
 */
export const get = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const synthesizeQueryValidation = SynthesizeQuerySchema.safeParse(req.query);

  if (!synthesizeQueryValidation.success) {
    throw apiError(
      ErrorCode.VALIDATION_ERROR,
      synthesizeQueryValidation.error.issues
    );
  }

  const synthesizeQuery = synthesizeQueryValidation.data;

  if (synthesizeQuery.method === 'stream') {
    try {
      const audioStream = await capCutService.synthesizeStream(synthesizeQuery);

      sendAudioStreamResponse(res, audioStream, (error: Error) => {
        logger.error('Failed to synthesize audio stream', error);

        if (!res.headersSent) {
          next(apiError(ErrorCode.BAD_GATEWAY, 'Failed to synthesize audio'));
          return;
        }

        res.end();
      });
      return;
    } catch (error) {
      logger.error('Failed to synthesize audio stream', error);
      throw apiError(ErrorCode.BAD_GATEWAY, 'Failed to synthesize audio');
    }
  }

  try {
    const audioResult = await capCutService.synthesizeBuffer(synthesizeQuery);
    sendAudioBufferResponse(res, audioResult);
  } catch (error) {
    logger.error('Failed to synthesize audio', error);
    throw apiError(ErrorCode.BAD_GATEWAY, 'Failed to synthesize audio');
  }
};
