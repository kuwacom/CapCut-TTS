import env from '@/configs/env';
import logger from '@/services/logger';
import type { GetTokenResponse } from '@/types/response';

const CAPCUT_APP_VERSION = '5.8.0';
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

export default async function getToken(): Promise<GetTokenResponse | null> {
  const headers = new Headers({
    Appvr: CAPCUT_APP_VERSION,
    'Device-Time': env.DEVICE_TIME,
    Origin: 'https://www.capcut.com',
    Pf: '7',
    Sign: env.SIGN,
    'Sign-Ver': '1',
    'User-Agent': env.USER_AGENT,
  });

  try {
    const response = await fetch(`${env.CAPCUT_API_URL}/common/tts/token`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error(
        `Failed to fetch token: ${response.status} ${response.statusText}`
      );
      return null;
    }

    return (await response.json()) as GetTokenResponse;
  } catch (error) {
    logger.error('Failed to fetch token.', error);
    return null;
  }
}
