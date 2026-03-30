import { CapCutEditApiClient } from '@/api/capcut-edit/apiClient';
import type { ApiRequester } from '@/types/api';

interface CreateTtsTaskParams {
  requester: ApiRequester;
  searchParams: Record<string, string>;
  headers: HeadersInit;
  body: BodyInit;
}

/**
 * editor intelligence TTS タスクを作成する
 */
export const createTtsTask = ({
  requester,
  searchParams,
  headers,
  body,
}: CreateTtsTaskParams) =>
  CapCutEditApiClient.request({
    requester,
    path: '/lv/v2/intelligence/create',
    searchParams,
    method: 'POST',
    headers,
    body,
  });
