import type { Request, Response } from 'express';
import { LegacySynthesizeQuerySchema } from '@/schemas/legacySynthesize';
import legacyCapCutService from '@/services/LegacyCapCutService';
import logger from '@/services/logger';

/**
 * 旧 token + websocket フロー用の音声合成エンドポイント
 */
export const synthesizeLegacy = async (req: Request, res: Response) => {
  const synthesizeQueryValidation = LegacySynthesizeQuerySchema.safeParse(
    req.query
  );

  if (!synthesizeQueryValidation.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: synthesizeQueryValidation.error.issues,
    });
    return;
  }

  if (!legacyCapCutService.isConfigured()) {
    res.status(503).json({
      error:
        'Legacy CapCut endpoint is not configured. Set LEGACY_DEVICE_TIME and LEGACY_SIGN',
    });
    return;
  }

  const synthesizeQuery = synthesizeQueryValidation.data;

  if (synthesizeQuery.method === 'stream') {
    try {
      const audioStream = await legacyCapCutService.synthesizeStream(
        synthesizeQuery
      );

      audioStream.stream.on('error', (error) => {
        logger.error('Failed to synthesize legacy audio stream', error);

        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to synthesize legacy audio' });
          return;
        }

        res.end();
      });

      res.on('close', () => {
        if (!audioStream.stream.destroyed) {
          audioStream.stream.destroy();
        }
      });

      res.status(200);
      res.type(audioStream.contentType);
      audioStream.stream.pipe(res);
      return;
    } catch (error) {
      logger.error('Failed to synthesize legacy audio stream', error);
      res.status(502).json({ error: 'Failed to synthesize legacy audio' });
      return;
    }
  }

  try {
    const audioResult = await legacyCapCutService.synthesizeBuffer(
      synthesizeQuery
    );

    if (audioResult.contentLength) {
      res.setHeader('Content-Length', audioResult.contentLength);
    }

    res.type(audioResult.contentType).status(200).end(audioResult.buffer);
  } catch (error) {
    logger.error('Failed to synthesize legacy audio', error);
    res.status(502).json({ error: 'Failed to synthesize legacy audio' });
  }
};
