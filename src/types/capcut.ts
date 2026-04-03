/**
 * 音声合成リクエストの入力
 */
export interface SynthesizeOptions {
  text: string;
  type: number | string;
  voice?: string;
  pitch: number;
  speed: number;
  volume: number;
}

/**
 * 音声プリセットの内部表現
 */
export interface VoicePreset {
  title: string;
  description: string;
  speaker: string;
  effectId: string;
  resourceId: string;
}

/**
 * /models エンドポイントで返す音声モデル
 */
export interface VoiceModel {
  id: string;
  title: string;
  description: string;
  speaker: string;
  effectId: string;
  resourceId: string;
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
