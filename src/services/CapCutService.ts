import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { checkEmailRegistered } from '@/api/capcut-login/api/checkEmailRegistered';
import { emailLogin } from '@/api/capcut-login/api/emailLogin';
import { resolveRegion } from '@/api/capcut-login/api/resolveRegion';
import { userLogin } from '@/api/capcut-login/api/userLogin';
import { createEditApiSignature } from '@/api/capcut-edit/apiClient';
import { createMultiPlatformTts } from '@/api/capcut-edit/api/createMultiPlatformTts';
import { createTtsTask } from '@/api/capcut-edit/api/createTtsTask';
import { getUserWorkspaces } from '@/api/capcut-edit/api/getUserWorkspaces';
import { getVoiceModels } from '@/api/capcut-edit/api/getVoiceModels';
import { queryTtsTask } from '@/api/capcut-edit/api/queryTtsTask';
import { downloadAudio } from '@/api/capcut-media/api/downloadAudio';
import { getAccountInfo } from '@/api/capcut-web/api/getAccountInfo';
import { getLoginPage } from '@/api/capcut-web/api/getLoginPage';
import env from '@/configs/env';
import { CookieJar } from '@/lib/capcut/cookieJar';
import { capCutConstants } from '@/lib/capcut/constants';
import {
  CapCutApiError,
  unwrapJsonResponse,
} from '@/lib/capcut/responseUtils';
import {
  parseVoicePreset,
  resolveVoicePreset,
  toVoiceModels,
} from '@/lib/capcut/voiceUtils';
import { capCutVoiceCategoryIds } from '@/models/capcutVoiceCategories';
import { fallbackVoicePresets } from '@/models/capcutVoiceModels';
import capCutBundleService from '@/services/CapCutBundleService';
import logger from '@/services/logger';
import type {
  CapCutEditorBundleConfig,
  CapCutLoginBundleConfig,
} from '@/types/capcutBundle';
import type {
  AccountInfo,
  LoginResponse,
  MultiPlatformTtsResponse,
  RegionResponse,
  TtsQueryResponse,
  TtsTaskDetail,
  TtsTaskResponse,
  VoiceListResponse,
  WorkspaceInfo,
  WorkspaceListResponse,
} from '@/types/capcutApi';
import type {
  AudioResult,
  CapCutSessionState,
  SynthesizeOptions,
  VoiceModel,
  VoicePreset,
} from '@/types/capcut';
import type { PersistedSessionState } from '@/types/capcutSession';
import {
  buildSensitiveFormBody,
  createDeviceId,
  createEmailRegionHashWithSalt,
  createTrackingId,
  createVerifyFp,
  isSessionExpiredError,
  toPlaybackRate,
  toVolumeLevel,
} from '@/utils/capcutUtils';
import { getResponseBodySnippet } from '@/utils/httpUtils';

const {
  appId,
  editorAppVersion,
  loginSdkVersion,
  platformId,
  sessionValidateMs,
  signVersion,
  ttsMaxPollAttempts,
  ttsPlatform,
  ttsPollIntervalMs,
  ttsScene,
  ttsSmartToolType,
  voiceCacheMs,
  voicePanel,
  voicePanelSource,
  webAppVersion,
} = capCutConstants;

/**
 * CapCut とのセッション維持と TTS 実行を担当するサービス
 * 状態を持つ本体は services に残し、通信や変換の詳細は lib utils api へ逃がしている
 */
class CapCutService {
  private readonly cookieJar = new CookieJar();

  private readonly sessionStorePath = path.resolve(
    process.cwd(),
    env.CAPCUT_SESSION_STORE_PATH
  );

  private readonly restorePromise: Promise<void>;

  private deviceId = env.CAPCUT_DEVICE_ID ?? createDeviceId();

  private tdid = env.CAPCUT_TDID ?? createTrackingId();

  private session: CapCutSessionState | null = null;

  private sessionPromise: Promise<CapCutSessionState> | null = null;

  private voices: VoicePreset[] | null = null;

  private voicesLoadedAt = 0;

  private verifyFp = env.CAPCUT_VERIFY_FP ?? createVerifyFp();

  private runtimeLoginBundleConfig: CapCutLoginBundleConfig = {};

  private runtimeEditorBundleConfig: CapCutEditorBundleConfig = {
    sourceUrls: [],
  };

  constructor() {
    this.restorePromise = this.restorePersistedSession();
  }

  /**
   * 音声をバッファとして取得する
   */
  async synthesizeBuffer(options: SynthesizeOptions): Promise<AudioResult> {
    const response = await this.createAudioResponse(options);
    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      buffer,
      contentType: response.headers.get('content-type') ?? 'audio/mpeg',
      contentLength: response.headers.get('content-length') ?? undefined,
      fileName: this.extractFileName(response),
    };
  }

  /**
   * 音声をストリームとして取得する
   */
  async synthesizeStream(options: SynthesizeOptions) {
    const response = await this.createAudioResponse(options);

    if (!response.body) {
      throw new Error('CapCut audio response did not contain a body');
    }

    return {
      stream: Readable.fromWeb(
        response.body as unknown as import('node:stream/web').ReadableStream
      ),
      contentType: response.headers.get('content-type') ?? 'audio/mpeg',
      contentLength: response.headers.get('content-length') ?? undefined,
      fileName: this.extractFileName(response),
    };
  }

  /**
   * 利用可能な音声モデル一覧を返す
   */
  async listModels(): Promise<VoiceModel[]> {
    return toVoiceModels(await this.loadVoices());
  }

  /**
   * 起動時の事前ウォームアップ
   */
  async warmup() {
    await this.refreshLoginBundleConfig();
    await this.ensureAuthenticated();
    await this.loadVoices();
    void this.refreshEditorBundleConfig();
  }

  /**
   * セッションを確保する
   * 既存セッションが生きていれば再利用し、失効時だけ再ログインする
   */
  async ensureAuthenticated(force = false): Promise<CapCutSessionState> {
    await this.restorePromise;

    if (!force && this.session) {
      const sessionAge = Date.now() - this.session.verifiedAt;

      if (sessionAge < sessionValidateMs) {
        return this.session;
      }
    }

    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    this.sessionPromise = (async () => {
      if (!force && this.session) {
        try {
          await this.fetchPrimaryWorkspace();
          this.session.verifiedAt = Date.now();
          await this.persistSession();
          return this.session;
        } catch (error) {
          logger.info('CapCut session validation failed. Re-authenticating', {
            error,
          });
        }
      }

      return this.login();
    })().finally(() => {
      this.sessionPromise = null;
    });

    return this.sessionPromise;
  }

  /**
   * login bundle 由来の設定を更新する
   */
  private async refreshLoginBundleConfig() {
    this.runtimeLoginBundleConfig =
      await capCutBundleService.resolveLoginBundleConfig();
  }

  /**
   * editor bundle 由来の設定を更新する
   */
  private async refreshEditorBundleConfig() {
    this.runtimeEditorBundleConfig =
      await capCutBundleService.resolveEditorBundleConfig(
        this.fetchWithCookies.bind(this)
      );
  }

  /**
   * bundle 由来 login sdk version を返す
   */
  private getResolvedLoginSdkVersion() {
    return isSemverLike(this.runtimeLoginBundleConfig.sdkVersion)
      ? this.runtimeLoginBundleConfig.sdkVersion
      : loginSdkVersion;
  }

  /**
   * bundle 由来 login email path を返す
   */
  private getResolvedEmailLoginPath() {
    return this.runtimeLoginBundleConfig.emailLoginPath ?? '/passport/web/email/login/';
  }

  /**
   * bundle 由来 login user path を返す
   */
  private getResolvedUserLoginPath() {
    return this.runtimeLoginBundleConfig.userLoginPath ?? '/passport/web/user/login/';
  }

  /**
   * bundle 由来 region path を返す
   */
  private getResolvedRegionPath() {
    return this.runtimeLoginBundleConfig.regionPath ?? '/passport/web/region/';
  }

  /**
   * bundle 由来 account info path を返す
   */
  private getResolvedAccountInfoPath() {
    return this.runtimeLoginBundleConfig.accountInfoPath ?? '/passport/web/account/info/';
  }

  /**
   * bundle 由来 editor app version を返す
   */
  private getResolvedEditorAppVersion() {
    return isSemverLike(this.runtimeEditorBundleConfig.editorAppVersion)
      ? this.runtimeEditorBundleConfig.editorAppVersion
      : editorAppVersion;
  }

  /**
   * bundle 由来 web app version を返す
   */
  private getResolvedWebAppVersion() {
    return isSemverLike(this.runtimeEditorBundleConfig.webAppVersion)
      ? this.runtimeEditorBundleConfig.webAppVersion
      : webAppVersion;
  }

  /**
   * bundle 由来 version_name を返す
   */
  private getResolvedVersionName() {
    return isSemverLike(this.runtimeEditorBundleConfig.versionName)
      ? this.runtimeEditorBundleConfig.versionName
      : '11.0.0';
  }

  /**
   * bundle 由来 version_code を返す
   */
  private getResolvedVersionCode() {
    return isSemverLike(this.runtimeEditorBundleConfig.versionCode)
      ? this.runtimeEditorBundleConfig.versionCode
      : '11.0.0';
  }

  /**
   * bundle 由来 sdk_version を返す
   */
  private getResolvedSdkVersion() {
    return isSemverLike(this.runtimeEditorBundleConfig.sdkVersion)
      ? this.runtimeEditorBundleConfig.sdkVersion
      : '19.3.0';
  }

  /**
   * bundle 由来 effect_sdk_version を返す
   */
  private getResolvedEffectSdkVersion() {
    return isSemverLike(this.runtimeEditorBundleConfig.effectSdkVersion)
      ? this.runtimeEditorBundleConfig.effectSdkVersion
      : '19.3.0';
  }

  /**
   * bundle 由来 voice panel を返す
   */
  private getResolvedVoicePanel() {
    return this.runtimeEditorBundleConfig.voicePanel ?? voicePanel;
  }

  /**
   * bundle 由来 voice panel source を返す
   */
  private getResolvedVoicePanelSource() {
    return this.runtimeEditorBundleConfig.voicePanelSource ?? voicePanelSource;
  }

  /**
   * bundle 由来の voice category ids を返す
   */
  private getResolvedVoiceCategoryIds() {
    return this.runtimeEditorBundleConfig.voiceCategoryIds?.length
      ? this.runtimeEditorBundleConfig.voiceCategoryIds
      : capCutVoiceCategoryIds;
  }

  /**
   * bundle 由来 voice list path を返す
   */
  private getResolvedVoiceListPath() {
    return (
      this.runtimeEditorBundleConfig.voiceListPath ??
      '/artist/v1/effect/get_resources_by_category_id'
    );
  }

  /**
   * bundle 由来 workspace path を返す
   */
  private getResolvedWorkspacePath() {
    return (
      this.runtimeEditorBundleConfig.workspacePath ??
      '/cc/v1/workspace/get_user_workspaces'
    );
  }

  /**
   * bundle 由来 multi_platform path を返す
   */
  private getResolvedMultiPlatformPath() {
    const extractedPath = this.runtimeEditorBundleConfig.multiPlatformPath;
    if (!extractedPath) {
      return '/storyboard/v1/tts/multi_platform';
    }

    return extractedPath.startsWith('/storyboard/')
      ? extractedPath
      : '/storyboard/v1/tts/multi_platform';
  }

  /**
   * bundle 由来 create task path を返す
   */
  private getResolvedCreateTaskPath() {
    const extractedPath = this.runtimeEditorBundleConfig.createTaskPath;
    if (!extractedPath) {
      return '/lv/v2/intelligence/create';
    }

    return extractedPath.startsWith('/lv/')
      ? extractedPath
      : `/lv/v2${extractedPath}`;
  }

  /**
   * bundle 由来 query task path を返す
   */
  private getResolvedQueryTaskPath() {
    const extractedPath = this.runtimeEditorBundleConfig.queryTaskPath;
    if (!extractedPath) {
      return '/lv/v2/intelligence/query';
    }

    return extractedPath.startsWith('/lv/')
      ? extractedPath
      : `/lv/v2${extractedPath}`;
  }

  /**
   * bundle 由来 sign recipe を返す
   */
  private getResolvedSignRecipe() {
    return this.runtimeEditorBundleConfig.signRecipe;
  }

  /**
   * bundle 由来 platform id を返す
   */
  private getResolvedPlatformId() {
    return this.runtimeEditorBundleConfig.signRecipe?.platformId ?? platformId;
  }

  /**
   * bundle 由来 sign version を返す
   */
  private getResolvedSignVersion() {
    return this.runtimeEditorBundleConfig.signRecipe?.signVersion ?? signVersion;
  }

  /**
   * 永続化済みセッションを復元する
   */
  private async restorePersistedSession() {
    if (env.CAPCUT_DEVICE_ID && env.CAPCUT_VERIFY_FP) {
      return;
    }

    try {
      const raw = await fs.readFile(this.sessionStorePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedSessionState;

      if (
        !parsed ||
        !Array.isArray(parsed.cookies) ||
        typeof parsed.verifyFp !== 'string' ||
        typeof parsed.deviceId !== 'string'
      ) {
        return;
      }

      if (!env.CAPCUT_DEVICE_ID) {
        this.deviceId = parsed.deviceId;
      }

      if (!env.CAPCUT_VERIFY_FP) {
        this.verifyFp = parsed.verifyFp;
      }

      if (!env.CAPCUT_TDID && typeof parsed.tdid === 'string' && parsed.tdid) {
        this.tdid = parsed.tdid;
      }

      this.cookieJar.hydrate(parsed.cookies);
      this.syncDeviceIdFromCookies();
      this.session = parsed.session ?? null;
    } catch (error) {
      const code =
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : null;

      if (code !== 'ENOENT') {
        logger.warn('Failed to restore persisted CapCut session', { error });
      }
    }
  }

  /**
   * セッションをディスクへ保存する
   */
  private async persistSession() {
    try {
      await fs.mkdir(path.dirname(this.sessionStorePath), { recursive: true });

      const payload: PersistedSessionState = {
        session: this.session,
        cookies: this.cookieJar.serialize(),
        verifyFp: this.verifyFp,
        deviceId: this.deviceId,
        tdid: this.tdid,
      };

      await fs.writeFile(
        this.sessionStorePath,
        JSON.stringify(payload, null, 2),
        'utf8'
      );
    } catch (error) {
      logger.warn('Failed to persist CapCut session', { error });
    }
  }

  /**
   * passport 系 API 用の CSRF Cookie を事前に投入する
   */
  private seedPassportCookies() {
    const csrf = crypto.randomBytes(16).toString('hex');
    const domains = [
      new URL(env.CAPCUT_WEB_URL).hostname,
      new URL(env.CAPCUT_LOGIN_HOST).hostname,
      new URL(env.CAPCUT_FALLBACK_LOGIN_HOST).hostname,
    ];

    for (const domain of domains) {
      this.cookieJar.set('passport_csrf_token', csrf, domain);
      this.cookieJar.set('passport_csrf_token_default', csrf, domain);
    }
  }

  /**
   * CapCut へログインしてワークスペースまで確定させる
   */
  private async login(): Promise<CapCutSessionState> {
    logger.info('CapCut login flow started');
    this.cookieJar.clear();
    this.seedPassportCookies();
    this.verifyFp = env.CAPCUT_VERIFY_FP ?? createVerifyFp();
    await this.refreshLoginBundleConfig();
    await this.primeCookies();

    const resolvedRegion = await this.resolveLoginRegion().catch((error) => {
      logger.info('CapCut region bootstrap failed. Falling back to defaults', {
        error,
      });
      return null;
    });

    const loginHosts = [
      resolvedRegion?.domain,
      env.CAPCUT_LOGIN_HOST,
      env.CAPCUT_FALLBACK_LOGIN_HOST,
    ].filter(
      (value, index, values): value is string =>
        Boolean(value) && values.indexOf(value) === index
    );

    let lastError: unknown;

    for (const loginHost of loginHosts) {
      try {
        await this.primeLoginState(loginHost);
        const loginData = await this.loginWithHost(loginHost);
        const accountInfo = await this.fetchAccountInfo().catch((error) => {
          logger.info(
            `CapCut account info lookup failed after login via ${loginHost}`,
            { error }
          );
          return null;
        });
        const workspace = await this.fetchPrimaryWorkspace();

        const session: CapCutSessionState = {
          userId:
            normalizeStringId(accountInfo?.user_id) ??
            normalizeStringId(loginData.user_id_str) ??
            normalizeStringId(loginData.user_id) ??
            '',
          screenName:
            normalizeString(accountInfo?.screen_name) ??
            normalizeString(loginData.screen_name) ??
            '',
          workspaceId: workspace.workspace_id,
          loginHost,
          verifyFp: this.verifyFp,
          deviceId: this.deviceId,
          loggedInAt: Date.now(),
          verifiedAt: Date.now(),
        };

        if (!session.userId || !session.workspaceId) {
          throw new Error('CapCut login did not expose user or workspace info');
        }

        this.session = session;
        await this.persistSession();
        void this.refreshEditorBundleConfig();
        logger.info('CapCut session established', {
          userId: session.userId,
          workspaceId: session.workspaceId,
          loginHost,
        });
        return session;
      } catch (error) {
        lastError = error;
        logger.warn(`CapCut login via ${loginHost} failed`, { error });

        if (!shouldTryOtherLoginHost(error)) {
          break;
        }
      }
    }

    this.session = null;
    await this.persistSession();

    throw lastError instanceof Error
      ? lastError
      : new Error('CapCut login failed');
  }

  /**
   * login ページ取得で Cookie 群を初期化する
   */
  private async primeCookies() {
    const response = await getLoginPage({
      requester: this.fetchWithCookies.bind(this),
      path: `/${env.CAPCUT_PAGE_LOCALE}/login`,
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': env.CAPCUT_LOCALE,
        'User-Agent': env.USER_AGENT,
      },
    });

    this.syncDeviceIdFromCookies();

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `CapCut login page bootstrap failed: ${response.status} ${response.statusText} ${getResponseBodySnippet(
          body
        )}`
      );
    }
  }

  /**
   * login 前に check_email_registered を叩いて SDK の前提状態を近づける
   */
  private async primeLoginState(loginHost: string) {
    try {
      await checkEmailRegistered({
        requester: this.fetchWithCookies.bind(this),
        host: loginHost,
        searchParams: {
          aid: appId,
          account_sdk_source: 'web',
          sdk_version: this.getResolvedLoginSdkVersion(),
          language: env.CAPCUT_LOCALE,
          verifyFp: this.verifyFp,
        },
        headers: {
          Accept: 'application/json, text/javascript',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': env.USER_AGENT,
          appid: appId,
          did: this.deviceId,
          Origin: env.CAPCUT_WEB_URL,
          Referer: `${env.CAPCUT_WEB_URL}/${env.CAPCUT_PAGE_LOCALE}/login`,
          'store-country-code': env.CAPCUT_STORE_COUNTRY_CODE,
          'store-country-code-src': 'uid',
          'x-tt-passport-csrf-token':
            this.getPassportCsrfToken(loginHost) ?? '',
        },
        body: buildSensitiveFormBody(
          {
            email: env.CAPCUT_EMAIL,
          },
          ['email']
        ),
      });
    } catch (error) {
      logger.debug('CapCut login preflight failed', { error, loginHost });
    }
  }

  /**
   * メールアドレスに応じた login host を問い合わせる
   */
  private async resolveLoginRegion(): Promise<RegionResponse> {
    const response = await resolveRegion({
      requester: this.fetchWithCookies.bind(this),
      host: env.CAPCUT_LOGIN_HOST,
      path: this.getResolvedRegionPath(),
      searchParams: {
        aid: appId,
        account_sdk_source: 'web',
        sdk_version: this.getResolvedLoginSdkVersion(),
        language: env.CAPCUT_LOCALE,
        verifyFp: this.verifyFp,
        mix_mode: '1',
      },
      headers: {
        Accept: 'application/json, text/javascript',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': env.USER_AGENT,
        appid: appId,
        did: this.deviceId,
        Origin: env.CAPCUT_WEB_URL,
        Referer: `${env.CAPCUT_WEB_URL}/`,
        'store-country-code': env.CAPCUT_STORE_COUNTRY_CODE,
        'store-country-code-src': 'cdn',
        'x-tt-passport-csrf-token': '',
      },
      body: new URLSearchParams({
        type: '2',
        hashed_id: createEmailRegionHashWithSalt(
          env.CAPCUT_EMAIL,
          this.runtimeLoginBundleConfig.emailHashSalt
        ),
      }).toString(),
    });

    return unwrapJsonResponse<RegionResponse>(
      response,
      'CapCut region bootstrap'
    );
  }

  /**
   * email/password ログインを実行する
   * まず email/login を試し、endpoint 不整合らしい場合だけ user/login へフォールバックする
   */
  private async loginWithHost(loginHost: string): Promise<LoginResponse> {
    const searchParams = {
      aid: appId,
      account_sdk_source: 'web',
      sdk_version: this.getResolvedLoginSdkVersion(),
      language: env.CAPCUT_LOCALE,
      verifyFp: this.verifyFp,
    };
    const headers = {
      Accept: 'application/json, text/javascript',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': env.USER_AGENT,
      appid: appId,
      did: this.deviceId,
      Origin: env.CAPCUT_WEB_URL,
      Referer: `${env.CAPCUT_WEB_URL}/${env.CAPCUT_PAGE_LOCALE}/login`,
      'store-country-code': env.CAPCUT_STORE_COUNTRY_CODE,
      'store-country-code-src': 'uid',
      'x-tt-passport-csrf-token': this.getPassportCsrfToken(loginHost) ?? '',
    };
    const body = buildSensitiveFormBody(
      {
        email: env.CAPCUT_EMAIL,
        password: env.CAPCUT_PASSWORD,
      },
      ['email', 'password']
    );

    try {
      return await unwrapJsonResponse<LoginResponse>(
        await emailLogin({
          requester: this.fetchWithCookies.bind(this),
          host: loginHost,
          path: this.getResolvedEmailLoginPath(),
          searchParams,
          headers,
          body,
        }),
        'CapCut passport /passport/web/email/login/'
      );
    } catch (error) {
      if (!shouldFallbackToUserLogin(error)) {
        throw error;
      }

      logger.info('CapCut email/login fallback to user/login', { error });
      return unwrapJsonResponse<LoginResponse>(
        await userLogin({
          requester: this.fetchWithCookies.bind(this),
          host: loginHost,
          path: this.getResolvedUserLoginPath(),
          searchParams,
          headers,
          body,
        }),
        'CapCut passport /passport/web/user/login/'
      );
    }
  }

  /**
   * アカウント情報を取得する
   */
  private async fetchAccountInfo(): Promise<AccountInfo> {
    return unwrapJsonResponse<AccountInfo>(
      await getAccountInfo({
        requester: this.fetchWithCookies.bind(this),
        path: this.getResolvedAccountInfoPath(),
        searchParams: {
          aid: appId,
          account_sdk_source: 'web',
          sdk_version: this.getResolvedLoginSdkVersion(),
          language: env.CAPCUT_LOCALE,
          verifyFp: this.verifyFp,
        },
        headers: {
          Accept: 'application/json, text/javascript',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': env.USER_AGENT,
          appid: appId,
          did: this.deviceId,
          Referer: `${env.CAPCUT_WEB_URL}/${env.CAPCUT_PAGE_LOCALE}/login`,
          'store-country-code': env.CAPCUT_STORE_COUNTRY_CODE,
          'store-country-code-src': 'uid',
          'x-tt-passport-csrf-token':
            this.getPassportCsrfToken(env.CAPCUT_WEB_URL) ?? '',
        },
      }),
      'CapCut account info'
    );
  }

  /**
   * デフォルトのワークスペースを取得する
   */
  private async fetchPrimaryWorkspace(): Promise<WorkspaceInfo> {
    const data = await this.requestSignedEditJson<WorkspaceListResponse>({
      path: this.getResolvedWorkspacePath(),
      appVersion: this.getResolvedWebAppVersion(),
      extraHeaders: {
        lan: env.CAPCUT_LOCALE,
        loc: 'sg',
      },
      body: {
        cursor: '0',
        count: 100,
        need_convert_workspace: true,
      },
      request: ({ headers, body }) =>
        getUserWorkspaces({
          requester: this.fetchWithCookies.bind(this),
          path: this.getResolvedWorkspacePath(),
          headers,
          body,
        }),
      context: 'CapCut workspace list',
    });

    const workspaces = Array.isArray(data.workspace_infos)
      ? data.workspace_infos
      : [];
    const workspace =
      workspaces.find((item) => item.role === 'owner') ?? workspaces[0];

    if (!workspace?.workspace_id) {
      throw new Error('CapCut workspace list was empty');
    }

    return workspace;
  }

  /**
   * 音声一覧をロードする
   */
  private async loadVoices(): Promise<VoicePreset[]> {
    const cacheAge = Date.now() - this.voicesLoadedAt;

    if (this.voices && cacheAge < voiceCacheMs) {
      return this.voices;
    }

    try {
      const voices = await this.requestVoiceList();
      this.voices = voices.length > 0 ? voices : fallbackVoicePresets;
      this.voicesLoadedAt = Date.now();
      return this.voices;
    } catch (error) {
      logger.warn('Failed to refresh CapCut voice catalog. Using fallback', {
        error,
      });
      this.voices = fallbackVoicePresets;
      this.voicesLoadedAt = Date.now();
      return this.voices;
    }
  }

  /**
   * CapCut の音声モデル一覧 API を叩く
   */
  private async requestVoiceList(): Promise<VoicePreset[]> {
    const voiceResponses = await Promise.allSettled(
      this.getResolvedVoiceCategoryIds().map(async (categoryId) => {
        const payload = await unwrapJsonResponse<VoiceListResponse>(
          await getVoiceModels({
            requester: this.fetchWithCookies.bind(this),
            path: this.getResolvedVoiceListPath(),
            searchParams: {
              aid: appId,
              version_name: this.getResolvedVersionName(),
              version_code: this.getResolvedVersionCode(),
              sdk_version: this.getResolvedSdkVersion(),
              effect_sdk_version: this.getResolvedEffectSdkVersion(),
              device_platform: 'web',
              region: env.CAPCUT_REGION,
              language: env.CAPCUT_LOCALE,
              device_type: 'web',
              channel: 'online',
            },
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              Origin: env.CAPCUT_WEB_URL,
              Referer: `${env.CAPCUT_WEB_URL}/`,
              'User-Agent': env.USER_AGENT,
              appid: appId,
              did: this.deviceId,
              'store-country-code': env.CAPCUT_STORE_COUNTRY_CODE,
              'store-country-code-src': 'uid',
            },
            body: JSON.stringify({
              panel: this.getResolvedVoicePanel(),
              category_id: categoryId,
              category_key: String(categoryId),
              panel_source: this.getResolvedVoicePanelSource(),
              pack_optional: {
                need_tag: true,
                need_thumb: true,
                thumb_opt: '{"is_support_webp":1}',
                image_pack_param: {
                  icon_limit: {
                    static_format: 'webp',
                    dynamic_format: 'awebp',
                    width: 100,
                    height: 100,
                  },
                },
              },
              offset: 0,
              count: 200,
            }),
          }),
          `CapCut voice catalog category ${categoryId}`
        );

        return Array.isArray(payload.effect_item_list)
          ? payload.effect_item_list
          : [];
      })
    );

    const voiceMap = new Map<string, VoicePreset>();

    for (const result of voiceResponses) {
      if (result.status !== 'fulfilled') {
        logger.warn('Failed to fetch one CapCut voice category', {
          error: result.reason,
        });
        continue;
      }

      const effectItems = result.value;
      for (const item of effectItems) {
        const voicePreset = parseVoicePreset(item);

        if (!voicePreset) {
          continue;
        }

        if (!voiceMap.has(voicePreset.resourceId)) {
          voiceMap.set(voicePreset.resourceId, voicePreset);
        }
      }
    }

    return Array.from(voiceMap.values());
  }

  /**
   * 実際の音声レスポンスを組み立てる
   * まず multi_platform を使い、失敗時だけ editor の create/query に退避する
   */
  private async createAudioResponse(
    options: SynthesizeOptions
  ): Promise<Response> {
    return this.createAudioResponseWithRetry(options, true);
  }

  /**
   * セッション切れだけ 1 回だけ再ログインして再試行する
   */
  private async createAudioResponseWithRetry(
    options: SynthesizeOptions,
    allowRetry: boolean
  ): Promise<Response> {
    try {
      const voices = await this.loadVoices();
      const voice = resolveVoicePreset(options.type, voices, options.voice);
      await this.ensureAuthenticated();

      try {
        return await this.createAudioViaMultiPlatform(voice, options);
      } catch (error) {
        logger.info(
          'CapCut multi_platform TTS failed. Falling back to editor intelligence flow',
          { error }
        );
      }

      const session = await this.ensureAuthenticated();
      const taskId = await this.createTtsTask(
        session.workspaceId,
        voice,
        options
      );
      const taskDetail = await this.waitForTtsTask(session.workspaceId, taskId);

      if (taskDetail.url) {
        return this.fetchDirectAudio(taskDetail.url);
      }

      const fallbackUrl = taskDetail.transcode_audio_info?.[0]?.url;
      if (fallbackUrl) {
        return this.fetchDirectAudio(fallbackUrl);
      }

      throw new Error('CapCut TTS task completed without an audio URL');
    } catch (error) {
      if (allowRetry && isSessionExpiredError(error)) {
        logger.info('CapCut session appears expired. Re-authenticating once', {
          error,
        });
        await this.ensureAuthenticated(true);
        return this.createAudioResponseWithRetry(options, false);
      }

      throw error;
    }
  }

  /**
   * 直接音声 URL を返す multi_platform フロー
   */
  private async createAudioViaMultiPlatform(
    voice: VoicePreset,
    options: SynthesizeOptions
  ): Promise<Response> {
    const ttsData = await this.requestSignedEditJson<MultiPlatformTtsResponse>({
      path: this.getResolvedMultiPlatformPath(),
      appVersion: this.getResolvedEditorAppVersion(),
      tdid: this.tdid,
      body: {
        texts: [options.text],
        tts_conf: {
          speaker: voice.speaker,
          rate: toPlaybackRate(options.speed),
          volume: toVolumeLevel(options.volume),
          name: voice.title,
          platform: 'sami',
          effect_id: voice.effectId,
          resource_id: voice.resourceId,
          is_clone: false,
        },
        need_url: true,
      },
      request: ({ headers, body }) =>
        createMultiPlatformTts({
          requester: this.fetchWithCookies.bind(this),
          path: this.getResolvedMultiPlatformPath(),
          headers,
          body,
        }),
      context: 'CapCut multi_platform TTS',
    });

    const audioUrl = ttsData.tts_materials?.[0]?.meta_data?.url;
    if (!audioUrl) {
      throw new Error('CapCut multi_platform TTS did not return an audio URL');
    }

    return this.fetchDirectAudio(audioUrl);
  }

  /**
   * editor intelligence タスクを作成する
   */
  private async createTtsTask(
    workspaceId: string,
    voice: VoicePreset,
    options: SynthesizeOptions
  ) {
    const data = await this.requestSignedEditJson<TtsTaskResponse>({
      path: this.getResolvedCreateTaskPath(),
      appVersion: this.getResolvedEditorAppVersion(),
      extraHeaders: {
        lan: env.CAPCUT_LOCALE,
      },
      searchParams: {
        aid: appId,
        device_platform: 'web',
        region: env.CAPCUT_REGION,
        web_id: this.deviceId,
      },
      body: {
        workspace_id: workspaceId,
        smart_tool_type: ttsSmartToolType,
        scene: ttsScene,
        params: JSON.stringify({
          text: options.text,
          platform: ttsPlatform,
        }),
        req_json: JSON.stringify({
          speaker: voice.speaker,
          audio_config: {},
          disable_caption: true,
          commerce: {
            resource_type: 'material_artist',
            benefit_type: 'resource_export',
            resource_id: voice.resourceId,
          },
        }),
      },
      request: ({ searchParams, headers, body }) =>
        createTtsTask({
          requester: this.fetchWithCookies.bind(this),
          path: this.getResolvedCreateTaskPath(),
          searchParams,
          headers,
          body,
        }),
      context: 'CapCut TTS create',
    });

    if (!data.task_id) {
      throw new Error('CapCut TTS create did not return task_id');
    }

    return data.task_id;
  }

  /**
   * editor intelligence タスクの完了を待つ
   */
  private async waitForTtsTask(
    workspaceId: string,
    taskId: string
  ): Promise<TtsTaskDetail> {
    for (let attempt = 0; attempt < ttsMaxPollAttempts; attempt += 1) {
      const data = await this.requestSignedEditJson<TtsQueryResponse>({
        path: this.getResolvedQueryTaskPath(),
        appVersion: this.getResolvedEditorAppVersion(),
        extraHeaders: {
          lan: env.CAPCUT_LOCALE,
        },
        searchParams: {
          aid: appId,
          device_platform: 'web',
          region: env.CAPCUT_REGION,
          web_id: this.deviceId,
        },
        body: {
          task_id: taskId,
          workspace_id: workspaceId,
          smart_tool_type: ttsSmartToolType,
        },
        request: ({ searchParams, headers, body }) =>
          queryTtsTask({
            requester: this.fetchWithCookies.bind(this),
            path: this.getResolvedQueryTaskPath(),
            searchParams,
            headers,
            body,
          }),
        context: 'CapCut TTS query',
      });

      const status = Number(data.status ?? 0);
      if (status === 2 && data.task_detail?.[0]) {
        return data.task_detail[0];
      }

      if (status !== 1) {
        throw new Error(`CapCut TTS query failed with status ${status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, ttsPollIntervalMs));
    }

    throw new Error('CapCut TTS query timed out');
  }

  /**
   * 直接音声 URL を取得する
   */
  private async fetchDirectAudio(url: string) {
    const response = await downloadAudio({
      requester: async (requestUrl, init) => fetch(requestUrl, init),
      url,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': env.USER_AGENT,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `CapCut audio download failed: ${response.status} ${response.statusText} ${getResponseBodySnippet(
          body
        )}`
      );
    }

    return response;
  }

  /**
   * edit-api 向け署名付き POST を送る
   * sign は最終 URL の path 末尾 7 文字と tdid を使うので、ここで組み立ててから送る
   */
  private async requestSignedEditJson<T>(options: {
    path: string;
    appVersion: string;
    body: unknown;
    searchParams?: Record<string, string>;
    extraHeaders?: Record<string, string>;
    tdid?: string;
    request: (params: {
      searchParams: Record<string, string>;
      headers: Headers;
      body: string;
    }) => Promise<Response>;
    context: string;
  }) {
    if (this.runtimeEditorBundleConfig.sourceUrls.length === 0) {
      await this.refreshEditorBundleConfig();
    }

    const searchParams = options.searchParams ?? {};
    const targetUrl = new URL(options.path, env.CAPCUT_EDIT_API_URL);

    for (const [key, value] of Object.entries(searchParams)) {
      targetUrl.searchParams.set(key, value);
    }

    const tdid = options.tdid ?? '';
    const { sign, deviceTime } = createEditApiSignature(
      targetUrl.toString(),
      this.getResolvedPlatformId(),
      options.appVersion,
      tdid,
      this.getResolvedSignRecipe()
    );

    return unwrapJsonResponse<T>(
      await options.request({
        searchParams,
        headers: new Headers({
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          Origin: env.CAPCUT_WEB_URL,
          Referer: `${env.CAPCUT_WEB_URL}/`,
          'User-Agent': env.USER_AGENT,
          appid: appId,
          appvr: options.appVersion,
          'device-time': deviceTime,
          did: this.deviceId,
          pf: this.getResolvedPlatformId(),
          sign,
          'sign-ver': this.getResolvedSignVersion(),
          'store-country-code': env.CAPCUT_STORE_COUNTRY_CODE,
          'store-country-code-src': 'uid',
          tdid,
          ...options.extraHeaders,
        }),
        body: JSON.stringify(options.body),
      }),
      options.context
    );
  }

  /**
   * Cookie を差し込んで fetch する共通口
   */
  private async fetchWithCookies(url: string, init: RequestInit) {
    const headers = new Headers(init.headers);
    const cookieHeader = this.cookieJar.getCookieHeader(url);

    if (cookieHeader) {
      headers.set('Cookie', cookieHeader);
    }

    logger.debug('CapCut request', {
      method: init.method ?? 'GET',
      url,
      headers: sanitizeHeadersForDebugLog(headers),
      body: toLoggableBody(init.body),
    });

    const response = await fetch(url, {
      ...init,
      headers,
    });

    this.cookieJar.storeFromResponse(response, url);
    this.syncDeviceIdFromCookies();
    void this.persistSession();

    let responseBodySnippet = '';
    try {
      const clonedResponse = response.clone();
      responseBodySnippet = getResponseBodySnippet(await clonedResponse.text());
    } catch (error) {
      responseBodySnippet = `[unavailable: ${
        error instanceof Error ? error.message : 'unknown error'
      }]`;
    }

    logger.debug('CapCut response', {
      method: init.method ?? 'GET',
      url,
      status: response.status,
      statusText: response.statusText,
      headers: sanitizeHeadersForDebugLog(new Headers(response.headers)),
      body: responseBodySnippet,
    });

    return response;
  }

  /**
   * Cookie から did 候補を同期する
   * _tea_web_id が取れたときはそれを最優先する
   */
  private syncDeviceIdFromCookies() {
    if (env.CAPCUT_DEVICE_ID) {
      return;
    }

    const cookieDeviceId =
      this.cookieJar.get('_tea_web_id') ??
      this.cookieJar.get('_tea_web_id', env.CAPCUT_WEB_URL) ??
      this.cookieJar.get('_tea_web_id', env.CAPCUT_LOGIN_HOST) ??
      this.cookieJar.get('web_id') ??
      this.cookieJar.get('did');

    if (cookieDeviceId) {
      this.deviceId = cookieDeviceId;
    }
  }

  /**
   * passport 系 API 向けの CSRF Cookie を取得する
   */
  private getPassportCsrfToken(url: string) {
    return (
      this.cookieJar.get('passport_csrf_token', url) ??
      this.cookieJar.get('passport_csrf_token_default', url)
    );
  }

  /**
   * Content-Disposition からファイル名を抽出する
   */
  private extractFileName(response: Response) {
    const disposition = response.headers.get('content-disposition');
    if (!disposition) {
      return undefined;
    }

    const match = disposition.match(/filename="?([^"]+)"?/i);
    return match?.[1];
  }
}

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value : null;

const normalizeStringId = (value: unknown) =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'bigint'
    ? String(value)
    : null;

/**
 * email/login 失敗時に user/login へフォールバックしてよいかを判定する
 * CapCut の業務エラー時は user/login へ進むと別のエラーで上書きされやすい
 */
const shouldFallbackToUserLogin = (error: unknown) =>
  error instanceof CapCutApiError &&
  (error.statusCode === 404 || error.statusCode === 405);

/**
 * 別 login host へ再試行してよいかを判定する
 * error_code が返っている時は host を変えても改善しにくいため、その場で止める
 */
const shouldTryOtherLoginHost = (error: unknown) =>
  !(error instanceof CapCutApiError && error.errorCode !== undefined);

const isSemverLike = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9._-]+)?$/.test(value);

/**
 * デバッグログ用に秘匿ヘッダーを伏せる
 */
const sanitizeHeadersForDebugLog = (headers: Headers) => {
  const hiddenHeaderNames = new Set([
    'cookie',
    'authorization',
    'x-tt-passport-csrf-token',
  ]);
  const entries = Object.fromEntries(headers.entries());

  for (const [key, value] of Object.entries(entries)) {
    if (hiddenHeaderNames.has(key.toLowerCase())) {
      entries[key] = value ? '[redacted]' : value;
    }
  }

  return entries;
};

/**
 * デバッグログ向けに本文を短く整形する
 */
const toLoggableBody = (body: BodyInit | null | undefined) => {
  if (typeof body === 'string') {
    return getResponseBodySnippet(body);
  }

  if (body === undefined || body === null) {
    return '';
  }

  return `[${body.constructor.name}]`;
};

export const capCutService = new CapCutService();

let sessionRefreshTimer: NodeJS.Timeout | null = null;

/**
 * CapCut セッションのバックグラウンド更新を開始する
 */
export const startCapCutSessionTask = async () => {
  try {
    await capCutService.warmup();
  } catch (error) {
    logger.warn(
      'Initial CapCut session warmup failed. The service will retry in the background',
      { error }
    );
  }

  if (sessionRefreshTimer) {
    clearInterval(sessionRefreshTimer);
  }

  sessionRefreshTimer = setInterval(
    () => {
      void capCutService.ensureAuthenticated().catch((error) => {
        logger.warn('Background CapCut session validation failed', { error });
      });
    },
    env.SESSION_REFRESH_INTERVAL_MINUTES * 60 * 1000
  );

  sessionRefreshTimer.unref?.();
};

export default capCutService;
