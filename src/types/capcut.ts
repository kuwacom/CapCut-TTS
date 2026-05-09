import type { Readable } from 'node:stream';

/**
 * 音声合成リクエストの入力
 */
export interface SynthesizeOptions {
  text: string;
  type: number | string;
  speaker?: string;
  pitch: number;
  speed: number;
  volume: number;
}

/**
 * 音声プリセットの内部表現
 */
export interface Speaker {
  title: string;
  description: string;
  speaker: string;
  effectId: string;
  resourceId: string;
  style?: string;
  language?: string;
}

/**
 * /speakers エンドポイントで返す話者
 */
export interface SpeakerInfo {
  id: string;
  resourceId: string;
  effectId: string;
  name: string;
  description: string;
  style: string;
  language: string;
}

/**
 * CapCut ログイン済みセッション
 */
export interface CapCutSessionState {
  userId: string;
  screenName: string;
  workspaceId: string;
  loginHost: string;
  verifyFp: string;
  deviceId: string;
  loggedInAt: number;
  verifiedAt: number;
}

/**
 * バッファ取得時の音声レスポンス
 */
export interface AudioResult {
  buffer: Buffer;
  contentType: string;
  contentLength?: string;
  fileName?: string;
}

/**
 * ストリーム取得時の音声レスポンス
 */
export interface AudioStreamResult {
  stream: Readable;
  contentType: string;
  contentLength?: string;
  fileName?: string;
}
