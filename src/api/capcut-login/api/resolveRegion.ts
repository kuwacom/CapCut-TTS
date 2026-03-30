import { CapCutLoginApiClient } from '@/api/capcut-login/apiClient';
import type { ApiRequester } from '@/types/api';

interface ResolveRegionParams {
  requester: ApiRequester;
  host: string;
  searchParams: Record<string, string>;
  headers: HeadersInit;
  body: BodyInit;
}

/**
 * email から login host を解決する API を呼ぶ
 */
export const resolveRegion = (params: ResolveRegionParams) =>
  CapCutLoginApiClient.request({
    ...params,
    path: '/passport/web/region/',
    method: 'POST',
  });
