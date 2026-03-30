import type { Request, Response } from 'express';
import { SynthesizeQuerySchema } from '@/schemas/synthesize';
import capCutService from '@/services/CapCutService';
import logger from '@/services/logger';

/**
 * 音声合成エンドポイント
 */
export const synthesize = async (req: Request, res: Response) => {
  const synthesizeQueryValidation = SynthesizeQuerySchema.safeParse(req.query);

  if (!synthesizeQueryValidation.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: synthesizeQueryValidation.error.issues,
    });
    return;
  }

  const synthesizeQuery = synthesizeQueryValidation.data;

  if (synthesizeQuery.method === 'stream') {
    try {
      const audioStream = await capCutService.synthesizeStream(synthesizeQuery);

      audioStream.stream.on('error', (error) => {
        logger.error('Failed to synthesize audio stream', error);

        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to synthesize audio' });
          return;
        }

        res.end();
      });

      res.on('close', () => {
        if (!audioStream.stream.destroyed) {
          audioStream.stream.destroy();
        }
      });

      if (audioStream.contentLength) {
        res.setHeader('Content-Length', audioStream.contentLength);
      }

      if (audioStream.fileName) {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${audioStream.fileName}"`
        );
      }

      res.status(200);
      res.type(audioStream.contentType);
      audioStream.stream.pipe(res);
      return;
    } catch (error) {
      logger.error('Failed to synthesize audio stream', error);
      res.status(502).json({ error: 'Failed to synthesize audio' });
      return;
    }
  }

  try {
    const audioResult = await capCutService.synthesizeBuffer(synthesizeQuery);

    if (audioResult.contentLength) {
      res.setHeader('Content-Length', audioResult.contentLength);
    }

    if (audioResult.fileName) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${audioResult.fileName}"`
      );
    }

    res.type(audioResult.contentType).status(200).end(audioResult.buffer);
  } catch (error) {
    logger.error('Failed to synthesize audio', error);
    res.status(502).json({ error: 'Failed to synthesize audio' });
  }
};
