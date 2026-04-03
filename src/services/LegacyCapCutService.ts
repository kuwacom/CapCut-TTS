import { Readable } from 'node:stream';
import { WebSocket, type RawData } from 'ws';
import env from '@/configs/env';
import logger from '@/services/logger';
import type { AudioResult } from '@/types/capcut';
import type {
  LegacyGetTokenResponse,
  LegacySynthesizeOptions,
  LegacySynthesizePayload,
  LegacySynthesizeTaskMessage,
  LegacyTaskStatus,
  LegacyTokenState,
} from '@/types/capcutLegacy';

const legacyCapCutAppId = '348188';
const legacyCapCutAppVersion = '5.8.0';
const legacyCapCutSampleRate = 24000;
const legacyDefaultSpeaker = 'BV016_streaming';
const legacyPlatform = '7';
const legacySignVersion = '1';
const legacyTokenRequestTimeoutMs = 10_000;
const legacyTokenRetryDelayMs = 60_000;

const legacySpeakers = [
  'BV525_streaming',
  'BV528_streaming',
  'BV017_streaming',
  'BV016_streaming',
  'BV023_streaming',
  'BV024_streaming',
  'BV018_streaming',
  'BV523_streaming',
  'BV521_streaming',
  'BV522_streaming',
  'BV524_streaming',
  'BV520_streaming',
  'VOV401_bytesing3_kangkangwuqu',
  'VOV402_bytesing3_oh',
  'VOV402_bytesing3_aidelizan',
  'jp_005',
] as const;

class LegacyCapCutService {
  private readonly tokenState: LegacyTokenState = {
    token: '',
    appKey: '',
    refreshedAt: 0,
  };

  private refreshPromise: Promise<LegacyTokenState> | null = null;

  private refreshTimer: NodeJS.Timeout | null = null;

  /**
   * 旧 token + websocket フローに必要な環境変数が揃っているか
   */
  isConfigured() {
    return Boolean(env.LEGACY_DEVICE_TIME && env.LEGACY_SIGN);
  }

  /**
   * 起動時の事前ウォームアップ
   */
  async warmup() {
    if (!this.isConfigured()) {
      return;
    }

    await this.refreshToken();
  }

  /**
   * 旧 websocket フローで音声をバッファとして取得する
   */
  async synthesizeBuffer(
    options: LegacySynthesizeOptions
  ): Promise<AudioResult> {
    const tokenState = await this.getTokenState();
    const buffer = await this.getAudioBuffer(tokenState, options);

    return {
      buffer,
      contentType: 'audio/wav',
      contentLength: String(buffer.byteLength),
    };
  }

  /**
   * 旧 websocket フローで音声をストリームとして取得する
   */
  async synthesizeStream(options: LegacySynthesizeOptions) {
    const tokenState = await this.getTokenState();

    return {
      stream: this.createAudioStream(tokenState, options),
      contentType: 'audio/wav',
      contentLength: undefined,
      fileName: undefined,
    };
  }

  /**
   * 現在有効な token を返す
   */
  async getTokenState(): Promise<LegacyTokenState> {
    this.assertConfigured();

    if (this.isTokenReady()) {
      return this.tokenState;
    }

    return this.refreshToken();
  }

  /**
   * token を取得し、以降の更新も予約する
   */
  async refreshToken(): Promise<LegacyTokenState> {
    this.assertConfigured();

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const tokenResponse = await this.fetchToken();

        this.tokenState.token = tokenResponse.data.token;
        this.tokenState.appKey = tokenResponse.data.app_key;
        this.tokenState.refreshedAt = Date.now();

        logger.info('Legacy CapCut token refreshed');
        this.scheduleRefresh(env.LEGACY_TOKEN_INTERVAL * 60 * 60 * 1000);
        return this.tokenState;
      } catch (error) {
        this.scheduleRefresh(legacyTokenRetryDelayMs);

        if (this.isTokenReady()) {
          logger.warn(
            'Legacy token refresh failed. Using the previous token until the next retry',
            { error }
          );
          return this.tokenState;
        }

        logger.error('Legacy token refresh failed', error);
        throw error;
      }
    })().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  /**
   * 起動中のバックグラウンド更新を開始する
   */
  async startRefreshTask() {
    if (!this.isConfigured()) {
      logger.info(
        'Legacy CapCut endpoint is disabled because LEGACY_DEVICE_TIME / LEGACY_SIGN are not configured'
      );
      return;
    }

    try {
      await this.warmup();
    } catch (error) {
      logger.warn(
        'Initial legacy token fetch failed. The service will retry in the background',
        { error }
      );
    }
  }

  /**
   * 旧 token API を叩く
   */
  private async fetchToken(): Promise<LegacyGetTokenResponse> {
    const response = await fetch(
      `${env.LEGACY_CAPCUT_API_URL}/common/tts/token`,
      {
        method: 'POST',
        headers: new Headers({
          Appvr: legacyCapCutAppVersion,
          'Device-Time': env.LEGACY_DEVICE_TIME ?? '',
          Origin: env.CAPCUT_WEB_URL,
          Pf: legacyPlatform,
          Sign: env.LEGACY_SIGN ?? '',
          'Sign-Ver': legacySignVersion,
          'User-Agent': env.USER_AGENT,
        }),
        signal: AbortSignal.timeout(legacyTokenRequestTimeoutMs),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Legacy token request failed: ${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as LegacyGetTokenResponse;

    if (!payload?.data?.token || !payload?.data?.app_key) {
      throw new Error('Legacy token response did not contain token metadata');
    }

    return payload;
  }

  /**
   * バッファ用 websocket フロー
   */
  private async getAudioBuffer(
    tokenState: LegacyTokenState,
    options: LegacySynthesizeOptions
  ) {
    return new Promise<Buffer>((resolve, reject) => {
      let audioBuffer = Buffer.alloc(0);
      let settled = false;
      const startedAt = Date.now();
      const ws = new WebSocket(this.getWebSocketUrl());

      const resolveOnce = (buffer: Buffer) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(buffer);
      };

      const rejectOnce = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      };

      ws.on('open', () => {
        logger.debug('Connected to legacy CapCut websocket');
        ws.send(this.buildTaskMessage(tokenState, options));
      });

      ws.on('message', (data) => {
        const taskStatus = parseLegacyTaskStatus(data);

        if (!taskStatus) {
          audioBuffer = Buffer.concat([audioBuffer, rawDataToBuffer(data)]);
          return;
        }

        if (taskStatus.event === 'TaskStarted') {
          logger.debug(`Legacy task started: ${taskStatus.task_id}`);
          return;
        }

        if (taskStatus.event === 'TaskFinished') {
          logger.debug(
            `Legacy task finished: ${taskStatus.task_id} / Audio Buffer Size: ${audioBuffer.byteLength} bytes / Tasking Time: ${
              Date.now() - startedAt
            }ms`
          );
          ws.close();
          resolveOnce(audioBuffer);
          return;
        }

        if (
          taskStatus.event === 'TaskFailed' ||
          taskStatus.status_code >= 400
        ) {
          ws.close();
          rejectOnce(
            new Error(
              `Legacy task failed: ${taskStatus.status_code} ${taskStatus.status_text}`
            )
          );
        }
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error while buffering legacy audio', error);
        rejectOnce(
          error instanceof Error
            ? error
            : new Error('Legacy CapCut websocket error')
        );
      });

      ws.on('close', () => {
        if (!settled) {
          rejectOnce(
            new Error('Legacy CapCut websocket closed before the task finished')
          );
        }
      });
    });
  }

  /**
   * ストリーム用 websocket フロー
   */
  private createAudioStream(
    tokenState: LegacyTokenState,
    options: LegacySynthesizeOptions
  ) {
    const audioStream = new Readable({
      read() {},
    });
    const startedAt = Date.now();
    const ws = new WebSocket(this.getWebSocketUrl());
    let taskFinished = false;

    ws.on('open', () => {
      logger.debug('Connected to legacy CapCut websocket');
      ws.send(this.buildTaskMessage(tokenState, options));
    });

    ws.on('message', (data) => {
      const taskStatus = parseLegacyTaskStatus(data);

      if (!taskStatus) {
        audioStream.push(rawDataToBuffer(data));
        return;
      }

      if (taskStatus.event === 'TaskStarted') {
        logger.debug(`Legacy task started: ${taskStatus.task_id}`);
        return;
      }

      if (taskStatus.event === 'TaskFinished') {
        taskFinished = true;
        logger.debug(
          `Legacy task finished: ${taskStatus.task_id} / Tasking Time: ${
            Date.now() - startedAt
          }ms`
        );
        ws.close();
        audioStream.push(null);
        return;
      }

      if (taskStatus.event === 'TaskFailed' || taskStatus.status_code >= 400) {
        audioStream.destroy(
          new Error(
            `Legacy task failed: ${taskStatus.status_code} ${taskStatus.status_text}`
          )
        );
      }
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error while streaming legacy audio', error);
      audioStream.destroy(
        error instanceof Error
          ? error
          : new Error('Legacy CapCut websocket error')
      );
    });

    ws.on('close', () => {
      if (!taskFinished && !audioStream.destroyed && !audioStream.readableEnded) {
        audioStream.destroy(
          new Error('Legacy CapCut websocket closed before the task finished')
        );
      }
    });

    audioStream.on('close', () => {
      if (
        ws.readyState === WebSocket.CONNECTING ||
        ws.readyState === WebSocket.OPEN
      ) {
        ws.close();
      }
    });

    return audioStream;
  }

  /**
   * websocket に送る StartTask メッセージを作る
   */
  private buildTaskMessage(
    tokenState: LegacyTokenState,
    options: LegacySynthesizeOptions
  ) {
    const payload: LegacySynthesizePayload = {
      text: options.text,
      speaker: resolveLegacySpeaker(options.type),
      pitch: options.pitch,
      speed: options.speed,
      volume: options.volume,
      rate: legacyCapCutSampleRate,
      appid: legacyCapCutAppId,
    };
    const taskMessage: LegacySynthesizeTaskMessage = {
      token: tokenState.token,
      appkey: tokenState.appKey,
      namespace: 'TTS',
      event: 'StartTask',
      payload: JSON.stringify(payload),
    };

    return JSON.stringify(taskMessage);
  }

  /**
   * websocket の接続先 URL を返す
   */
  private getWebSocketUrl() {
    return `${env.LEGACY_BYTEINTL_API_URL}/ws`;
  }

  /**
   * token 更新予約を入れ直す
   */
  private scheduleRefresh(delayMs: number) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = setTimeout(() => {
      void this.refreshToken();
    }, delayMs);

    this.refreshTimer.unref?.();
  }

  /**
   * token キャッシュが埋まっているか
   */
  private isTokenReady() {
    return Boolean(this.tokenState.token && this.tokenState.appKey);
  }

  /**
   * 旧ルートが利用可能かをチェックする
   */
  private assertConfigured() {
    if (this.isConfigured()) {
      return;
    }

    throw new Error(
      'Legacy CapCut endpoint is not configured. Set LEGACY_DEVICE_TIME and LEGACY_SIGN'
    );
  }
}

const resolveLegacySpeaker = (type: number) =>
  legacySpeakers[type] ?? legacyDefaultSpeaker;

const rawDataToBuffer = (data: RawData): Buffer => {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data.map((chunk) => Buffer.from(chunk)));
  }

  return Buffer.from(data);
};

const parseLegacyTaskStatus = (data: RawData): LegacyTaskStatus | null => {
  try {
    return JSON.parse(rawDataToBuffer(data).toString()) as LegacyTaskStatus;
  } catch {
    return null;
  }
};

export const legacyCapCutService = new LegacyCapCutService();

export const startLegacyTokenTask = async () => {
  await legacyCapCutService.startRefreshTask();
};

export default legacyCapCutService;
