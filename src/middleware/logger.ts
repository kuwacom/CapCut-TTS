import type { NextFunction, Request, Response } from 'express';
import logger from '@/services/logger';

/**
 * リクエストとレスポンス時間をログへ出す
 */
export const loggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startedAt = Date.now();
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const sourceIp =
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ??
    (Array.isArray(realIp) ? realIp[0] : realIp) ??
    req.ip;
  const host = req.get('host') ?? '';

  logger.info('Incoming request', {
    sourceIp,
    host,
  });

  res.on('finish', () => {
    logger.info('Completed request', {
      sourceIp,
      host,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
};
