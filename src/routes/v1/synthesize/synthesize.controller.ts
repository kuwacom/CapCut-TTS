import type { Request, Response } from 'express';
import createAudioStream from '@/api/createAudioStream';
import getAudioBuffer from '@/api/getAudioBuffer';
import { SynthesizeQuerySchema } from '@/schemas/synthesize';
import logger from '@/services/logger';
import { getTokenState } from '@/services/token';

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

  let tokenState;
  try {
    tokenState = await getTokenState();
  } catch (error) {
    logger.error('CapCut token is unavailable.', error);
    res.status(503).json({ error: 'CapCut token is unavailable' });
    return;
  }

  if (synthesizeQuery.method === 'stream') {
    const audioStream = createAudioStream(
      tokenState.token,
      tokenState.appKey,
      synthesizeQuery
    );

    audioStream.on('error', (error) => {
      logger.error('Failed to synthesize audio stream.', error);

      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to synthesize audio' });
        return;
      }

      res.end();
    });

    res.on('close', () => {
      if (!audioStream.destroyed) {
        audioStream.destroy();
      }
    });

    res.status(200);
    res.type('audio/wav');
    audioStream.pipe(res);
    return;
  }

  const audioBuffer = await getAudioBuffer(
    tokenState.token,
    tokenState.appKey,
    synthesizeQuery
  );

  if (!audioBuffer) {
    res.status(502).json({ error: 'Failed to synthesize audio' });
    return;
  }

  res.type('audio/wav').status(200).end(audioBuffer);
};
