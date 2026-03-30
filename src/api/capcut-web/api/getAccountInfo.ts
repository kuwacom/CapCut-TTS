import { CapCutWebApiClient } from '@/api/capcut-web/apiClient';
import type { ApiRequester } from '@/types/api';

interface GetAccountInfoParams {
  requester: ApiRequester;
  searchParams: Record<string, string>;
  headers: HeadersInit;
}

/**
 * ログイン済みアカウント情報を取得する
 */
export const getAccountInfo = ({
  requester,
  searchParams,
  headers,
}: GetAccountInfoParams) =>
  CapCutWebApiClient.request({
    requester,
    path: '/passport/web/account/info/',
    searchParams,
    method: 'GET',
    headers,
  });
