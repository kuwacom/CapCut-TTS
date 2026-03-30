import env from '@/configs/env';
import getToken from '@/api/getToken';
import logger from '@/services/logger';
import type { TokenState } from '@/types/capcut';

const TOKEN_RETRY_DELAY_MS = 60_000;

const tokenState: TokenState = {
  token: '',
  appKey: '',
  refreshedAt: 0,
};

let refreshPromise: Promise<TokenState> | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

const scheduleRefresh = (delayMs: number) => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    void refreshToken();
  }, delayMs);

  refreshTimer.unref?.();
};

export const isTokenReady = () =>
  Boolean(tokenState.token.length > 0 && tokenState.appKey.length > 0);

export const refreshToken = async (): Promise<TokenState> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const tokenResponse = await getToken();

    if (!tokenResponse) {
      scheduleRefresh(TOKEN_RETRY_DELAY_MS);

      if (isTokenReady()) {
        logger.warn(
          'Token refresh failed. Using the previous token until the next retry.'
        );
        return tokenState;
      }

      throw new Error('Failed to acquire CapCut token.');
    }

    tokenState.token = tokenResponse.data.token;
    tokenState.appKey = tokenResponse.data.app_key;
    tokenState.refreshedAt = Date.now();

    logger.info('CapCut token refreshed.');

    scheduleRefresh(env.TOKEN_INTERVAL * 60 * 60 * 1000);

    return tokenState;
  })()
    .catch((error) => {
      logger.error('Token refresh failed.', error);
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

export const getTokenState = async (): Promise<TokenState> => {
  if (isTokenReady()) {
    return tokenState;
  }

  return refreshToken();
};

export const startTokenRefreshTask = async (): Promise<void> => {
  try {
    await refreshToken();
  } catch {
    logger.warn(
      'Initial token fetch failed. The service will retry in the background.'
    );
  }
};
