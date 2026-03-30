import { CapCutEditApiClient } from '@/api/capcut-edit/apiClient';
import type { ApiRequester } from '@/types/api';

interface GetVoiceModelsParams {
  requester: ApiRequester;
  searchParams: Record<string, string>;
  headers: HeadersInit;
  body: BodyInit;
}

/**
 * 音声モデル一覧を取得する
 */
export const getVoiceModels = ({
  requester,
  searchParams,
  headers,
  body,
}: GetVoiceModelsParams) =>
  CapCutEditApiClient.request({
    requester,
    path: '/artist/v1/effect/get_resources_by_category_id',
    searchParams,
    method: 'POST',
    headers,
    body,
  });
