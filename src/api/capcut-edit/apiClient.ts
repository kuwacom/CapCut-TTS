import crypto from 'node:crypto';
import env from '@/configs/env';
import type { ApiRequester } from '@/types/api';

interface CapCutEditRequestOptions {
  requester: ApiRequester;
  path: string;
  searchParams?: Record<string, string>;
  method?: 'GET' | 'POST';
  headers?: HeadersInit;
  body?: BodyInit | null;
}

const resolveUrl = (
  path: string,
  searchParams: Record<string, string> = {}
) => {
  const url = new URL(path, env.CAPCUT_EDIT_API_URL);

  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
};

export const createEditApiSignature = (
  requestUrl: string,
  platformId: string,
  appVersion: string,
  tdid = ''
) => {
  const url = new URL(requestUrl);
  const deviceTime = Math.floor(Date.now() / 1000).toString();
  const raw = `9e2c|${url.pathname.slice(-7)}|${platformId}|${appVersion}|${deviceTime}|${tdid}|11ac`;

  return {
    sign: crypto.createHash('md5').update(raw).digest('hex').toLowerCase(),
    deviceTime,
  };
};

/**
 * edit-api ドメイン向けの共通リクエスト
 */
const request = async ({
  requester,
  path,
  searchParams = {},
  method = 'POST',
  headers,
  body,
}: CapCutEditRequestOptions) =>
  requester(resolveUrl(path, searchParams), {
    method,
    headers,
    body,
  });

export const CapCutEditApiClient = {
  resolveUrl,
  request,
};
