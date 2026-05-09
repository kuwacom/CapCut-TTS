import type { NextFunction, Request, Response } from 'express';
import {
  sendAudioBufferResponse,
  sendAudioStreamResponse,
} from '@/lib/audioResponse';
import { apiError, ErrorCode } from '@/lib/apiError';
import { SynthesizeBodySchema } from '@/schemas/synthesize';
import capCutService from '@/services/CapCutService';
import logger from '@/services/logger';

/**
 * ### post
 * `/v2/synthesize` を処理する
 *
 * @param req - Express リクエスト
 * @param res - Express レスポンス
 * @param next - NextFunction
 */
export const post = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const synthesizeBodyValidation = SynthesizeBodySchema.safeParse(req.body);

  if (!synthesizeBodyValidation.success) {
    throw apiError(
      ErrorCode.VALIDATION_ERROR,
      synthesizeBodyValidation.error.issues
    );
  }

  const synthesizeBody = synthesizeBodyValidation.data;

  if (synthesizeBody.method === 'stream') {
    try {
      const audioStream = await capCutService.synthesizeStream(synthesizeBody);

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
    const audioResult = await capCutService.synthesizeBuffer(synthesizeBody);
    sendAudioBufferResponse(res, audioResult);
  } catch (error) {
    logger.error('Failed to synthesize audio', error);
    throw apiError(ErrorCode.BAD_GATEWAY, 'Failed to synthesize audio');
  }
};