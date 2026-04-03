import fs from 'node:fs/promises';
import path from 'node:path';
import env from '@/configs/env';
import {
  extractScriptUrlsFromHtml,
} from '@/lib/capcutBundle/bundleExtractionUtils';
import {
  extractEditorBundleConfig,
  extractLoginBundleConfig,
  mergeEditorBundleConfig,
  mergeLoginBundleConfig,
} from '@/lib/capcutBundle/bundleExtractors';
import logger from '@/services/logger';
import type { ApiRequester } from '@/types/api';
import type { CapCutBundleConfig } from '@/types/capcutBundle';

const bundleCacheTtlMs = 30 * 60 * 1000;

const defaultBundleConfig = (): CapCutBundleConfig => ({
  discoveredAt: 0,
  login: {},
  editor: {
    sourceUrls: [],
  },
});

const toAbsoluteUrl = (url: string) =>
  new URL(url, env.CAPCUT_WEB_URL).toString();

const mergeBundleConfig = (
  current: CapCutBundleConfig,
  next: CapCutBundleConfig
): CapCutBundleConfig => ({
  discoveredAt: Math.max(current.discoveredAt, next.discoveredAt),
  login: {
    ...current.login,
    ...next.login,
  },
  editor: {
    ...current.editor,
    ...next.editor,
    sourceUrls: Array.from(
      new Set([...(current.editor.sourceUrls ?? []), ...(next.editor.sourceUrls ?? [])])
    ),
    signRecipe: {
      ...current.editor.signRecipe,
      ...next.editor.signRecipe,
    },
    voiceCategoryIds:
      next.editor.voiceCategoryIds && next.editor.voiceCategoryIds.length > 0
        ? Array.from(
            new Set([
              ...(current.editor.voiceCategoryIds ?? []),
              ...next.editor.voiceCategoryIds,
            ])
          ).sort((left, right) => left - right)
        : current.editor.voiceCategoryIds,
  },
});

/**
 * CapCut の live bundle から設定値を抽出してキャッシュする
 */
class CapCutBundleService {
  private loginBundleConfig: CapCutBundleConfig['login'] | null = null;

  private editorBundleConfig: CapCutBundleConfig['editor'] | null = null;

  private loginBundleDiscoveredAt = 0;

  private editorBundleDiscoveredAt = 0;

  private loginBundlePromise: Promise<CapCutBundleConfig['login']> | null = null;

  private editorBundlePromise: Promise<CapCutBundleConfig['editor']> | null = null;

  /**
   * login bundle 設定を返す
   */
  async resolveLoginBundleConfig() {
    await this.loadBundleConfigFromFile();

    if (
      this.loginBundleConfig &&
      Date.now() - this.loginBundleDiscoveredAt < bundleCacheTtlMs
    ) {
      return this.loginBundleConfig;
    }

    if (this.loginBundlePromise) {
      return this.loginBundlePromise;
    }

    this.loginBundlePromise = this.fetchLoginBundleConfig().finally(() => {
      this.loginBundlePromise = null;
    });

    return this.loginBundlePromise;
  }

  /**
   * editor bundle 設定を返す
   */
  async resolveEditorBundleConfig(requester?: ApiRequester) {
    await this.loadBundleConfigFromFile();

    if (
      this.editorBundleConfig &&
      Date.now() - this.editorBundleDiscoveredAt < bundleCacheTtlMs
    ) {
      return this.editorBundleConfig;
    }

    if (this.editorBundlePromise) {
      return this.editorBundlePromise;
    }

    this.editorBundlePromise = this.fetchEditorBundleConfig(requester).finally(
      () => {
        this.editorBundlePromise = null;
      }
    );

    return this.editorBundlePromise;
  }

  /**
   * 抽出済み設定ファイルがあれば読み込む
   */
  private async loadBundleConfigFromFile() {
    if (this.loginBundleConfig || this.editorBundleConfig) {
      return;
    }

    try {
      const raw = await fs.readFile(env.CAPCUT_BUNDLE_CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw) as CapCutBundleConfig;

      this.loginBundleConfig = parsed.login;
      this.editorBundleConfig = parsed.editor;
      this.loginBundleDiscoveredAt = parsed.discoveredAt;
      this.editorBundleDiscoveredAt = parsed.discoveredAt;

      logger.info('CapCut bundle config loaded from file', {
        path: env.CAPCUT_BUNDLE_CONFIG_PATH,
      });
    } catch (error) {
      const code =
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : null;

      if (code !== 'ENOENT') {
        logger.warn('Failed to load CapCut bundle config file', { error });
      }
    }
  }

  /**
   * 現在の bundle 設定をファイルへ保存する
   */
  private async persistBundleConfig() {
    const currentConfig: CapCutBundleConfig = {
      discoveredAt: Math.max(
        this.loginBundleDiscoveredAt,
        this.editorBundleDiscoveredAt
      ),
      login: this.loginBundleConfig ?? defaultBundleConfig().login,
      editor: this.editorBundleConfig ?? defaultBundleConfig().editor,
    };

    try {
      const absolutePath = path.resolve(process.cwd(), env.CAPCUT_BUNDLE_CONFIG_PATH);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(
        absolutePath,
        JSON.stringify(currentConfig, null, 2),
        'utf8'
      );

      logger.info('CapCut bundle config saved to file', {
        path: env.CAPCUT_BUNDLE_CONFIG_PATH,
      });
    } catch (error) {
      logger.warn('Failed to save CapCut bundle config file', { error });
    }
  }

  /**
   * login ページから account bundle を辿って抽出する
   */
  private async fetchLoginBundleConfig() {
    try {
      const response = await fetch(
        `${env.CAPCUT_WEB_URL}/${env.CAPCUT_PAGE_LOCALE}/login`,
        {
          headers: {
            'User-Agent': env.USER_AGENT,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch login page: ${response.status} ${response.statusText}`
        );
      }

      const html = await response.text();
      const scriptUrls = extractScriptUrlsFromHtml(html)
        .map(toAbsoluteUrl)
        .filter((url) => url.includes('npm.byted-sdk.account-api'));

      let loginConfig = defaultBundleConfig().login;

      for (const scriptUrl of scriptUrls) {
        const scriptResponse = await fetch(scriptUrl, {
          headers: {
            'User-Agent': env.USER_AGENT,
            Accept: '*/*',
          },
        });

        if (!scriptResponse.ok) {
          continue;
        }

        const bundleText = await scriptResponse.text();
        loginConfig = mergeLoginBundleConfig(
          loginConfig,
          extractLoginBundleConfig(bundleText, scriptUrl)
        );
      }

      this.loginBundleConfig = loginConfig;
      this.loginBundleDiscoveredAt = Date.now();
      await this.persistBundleConfig();
      logger.info('CapCut login bundle config extracted', loginConfig);
      return loginConfig;
    } catch (error) {
      logger.warn('Failed to extract CapCut login bundle config', { error });
      return this.loginBundleConfig ?? defaultBundleConfig().login;
    }
  }

  /**
   * editor 系ページから bundle を辿って抽出する
   */
  private async fetchEditorBundleConfig(requester?: ApiRequester) {
    const pageRequester: ApiRequester =
      requester ??
      (async (url, init) => fetch(url, init));

    const candidatePages = [
      `${env.CAPCUT_WEB_URL}/my-edit?from_page=landing_page&start_tab=video`,
      `${env.CAPCUT_WEB_URL}/editor?from_page=landing_page&start_tab=video`,
      `${env.CAPCUT_WEB_URL}/tools/text-to-speech`,
    ];

    try {
      let editorConfig = defaultBundleConfig().editor;

      for (const pageUrl of candidatePages) {
        const response = await pageRequester(pageUrl, {
          method: 'GET',
          headers: {
            'User-Agent': env.USER_AGENT,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          },
        });

        if (!response.ok) {
          continue;
        }

        const html = await response.text();
        const scriptUrls = extractScriptUrlsFromHtml(html)
          .map(toAbsoluteUrl)
          .filter((url) =>
            /video_online\/static\/js\/(editor|editor-template|services-|vendors-5\.0bd5a122)|smart_tools_online\/static\/js\/(tts|tts-initial)|platform_online\/static\/js\/async\/48427/.test(
              url
            )
          );

        for (const scriptUrl of scriptUrls) {
          const scriptResponse = await pageRequester(scriptUrl, {
            method: 'GET',
            headers: {
              'User-Agent': env.USER_AGENT,
              Accept: '*/*',
            },
          });

          if (!scriptResponse.ok) {
            continue;
          }

          const bundleText = await scriptResponse.text();
          editorConfig = mergeEditorBundleConfig(
            editorConfig,
            extractEditorBundleConfig(bundleText, scriptUrl)
          );
        }

        if (editorConfig.sourceUrls.length > 0) {
          break;
        }
      }

      this.editorBundleConfig = editorConfig;
      this.editorBundleDiscoveredAt = Date.now();
      await this.persistBundleConfig();
      logger.info('CapCut editor bundle config extracted', editorConfig);
      return editorConfig;
    } catch (error) {
      logger.warn('Failed to extract CapCut editor bundle config', { error });
      return this.editorBundleConfig ?? defaultBundleConfig().editor;
    }
  }
}

export const capCutBundleService = new CapCutBundleService();

export default capCutBundleService;
