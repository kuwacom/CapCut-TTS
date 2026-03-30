import type { RawData } from 'ws';
import env from '@/configs/env';
import type {
  SynthesizeOptions,
  SynthesizePayload,
  SynthesizeTaskMessage,
  TaskStatus,
} from '@/types/capcut';
import speakerParser from '@/utils/speakerParser';

const CAPCUT_APP_ID = '348188';
const CAPCUT_SAMPLE_RATE = 24000;

const buildSynthesizePayload = (
  options: SynthesizeOptions
): SynthesizePayload => ({
  text: options.text,
  speaker: speakerParser(options.type),
  pitch: options.pitch,
  speed: options.speed,
  volume: options.volume,
  rate: CAPCUT_SAMPLE_RATE,
  appid: CAPCUT_APP_ID,
});

export const buildTaskMessage = (
  token: string,
  appKey: string,
  options: SynthesizeOptions
): SynthesizeTaskMessage => ({
  token,
  appkey: appKey,
  namespace: 'TTS',
  event: 'StartTask',
  payload: JSON.stringify(buildSynthesizePayload(options)),
});

export const getWebSocketUrl = () => `${env.BYTEINTL_API_URL}/ws`;

export const rawDataToBuffer = (data: RawData): Buffer => {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data.map((chunk) => Buffer.from(chunk)));
  }

  return Buffer.from(data);
};

export const parseTaskStatus = (data: RawData): TaskStatus | null => {
  try {
    return JSON.parse(rawDataToBuffer(data).toString()) as TaskStatus;
  } catch {
    return null;
  }
};
