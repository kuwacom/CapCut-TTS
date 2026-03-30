import { CapCutEditApiClient } from '@/api/capcut-edit/apiClient';
import type { ApiRequester } from '@/types/api';

interface CreateMultiPlatformTtsParams {
  requester: ApiRequester;
  headers: HeadersInit;
  body: BodyInit;
}

/**
 * multi_platform TTS を実行する
 */
export const createMultiPlatformTts = ({
  requester,
  headers,
  body,
}: CreateMultiPlatformTtsParams) =>
  CapCutEditApiClient.request({
    requester,
    path: '/storyboard/v1/tts/multi_platform',
    method: 'POST',
    headers,
    body,
  });
