import { Logger } from 'tslog';
import env from '@/configs/env';

const logLevelToMinLevel = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
} as const;

/**
 * アプリ全体で共有するロガー
 */
const logger = new Logger({
  minLevel: logLevelToMinLevel[env.LOG_LEVEL],
});

export default logger;
