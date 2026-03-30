export interface SynthesizeOptions {
  text: string;
  type: number;
  pitch: number;
  speed: number;
  volume: number;
}

export interface SynthesizePayload {
  text: string;
  speaker: string;
  pitch: number;
  speed: number;
  volume: number;
  rate: number;
  appid: string;
}

export interface SynthesizeTaskMessage {
  token: string;
  appkey: string;
  namespace: 'TTS';
  event: 'StartTask';
  payload: string;
}

export interface TaskStatus {
  task_id: string;
  message_id: string;
  namespace: string;
  event: string;
  status_code: number;
  status_text: string;
}

export interface TokenState {
  token: string;
  appKey: string;
  refreshedAt: number;
}
