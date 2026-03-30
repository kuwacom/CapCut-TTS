import type { NextFunction, Request, Response } from 'express';
import logger from '@/services/logger';

export const loggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startedAt = Date.now();

  logger.debug(`Incoming request: ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    logger.debug(
      `Completed request: ${req.method} ${req.originalUrl} ${res.statusCode} ${
        Date.now() - startedAt
      }ms`
    );
  });

  next();
};
