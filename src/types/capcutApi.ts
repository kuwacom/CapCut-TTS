/**
 * CapCut のログイン応答
 */
export interface LoginResponse {
  sec_user_id?: string;
  screen_name?: string;
  user_id?: string | number;
  user_id_str?: string | number;
}

/**
 * CapCut のアカウント情報
 */
export interface AccountInfo {
  user_id?: string | number;
  screen_name?: string;
}

/**
 * CapCut のワークスペース情報
 */
export interface WorkspaceInfo {
  workspace_id: string;
  role?: string;
}

/**
 * ワークスペース一覧応答
 */
export interface WorkspaceListResponse {
  workspace_infos?: WorkspaceInfo[];
}

/**
 * 音声モデル一覧応答
 */
export interface VoiceListResponse {
  effect_item_list?: unknown[];
}

/**
 * TTS タスク作成応答
 */
export interface TtsTaskResponse {
  task_id?: string;
}

/**
 * TTS タスク詳細
 */
export interface TtsTaskDetail {
  url?: string;
  transcode_audio_info?: Array<{
    url?: string;
  }>;
}

/**
 * TTS タスク照会応答
 */
export interface TtsQueryResponse {
  status?: number;
  task_detail?: TtsTaskDetail[];
}

/**
 * リージョン解決応答
 */
export interface RegionResponse {
  country_code?: string;
  domain?: string;
}

/**
 * multi_platform TTS 応答
 */
export interface MultiPlatformTtsResponse {
  tts_materials?: Array<{
    meta_data?: {
      url?: string;
    };
  }>;
}
