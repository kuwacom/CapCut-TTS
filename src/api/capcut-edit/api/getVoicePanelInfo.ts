import { CapCutEditApiClient } from '@/api/capcut-edit/apiClient';
import type { ApiRequester } from '@/types/api';

interface GetVoicePanelInfoParams {
  requester: ApiRequester;
  path?: string;
  searchParams: Record<string, string>;
  headers: HeadersInit;
  body: BodyInit;
}

/**
 * voice panel に紐づくカテゴリと音声リソースを一括取得する
 */
export const getVoicePanelInfo = ({
  requester,
  path,
  searchParams,
  headers,
  body,
}: GetVoicePanelInfoParams) =>
  CapCutEditApiClient.request({
    requester,
    path: path ?? '/artist/v1/panel/get_panel_info',
    searchParams,
    method: 'POST',
    headers,
    body,
  });
