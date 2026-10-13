import fs from 'node:fs/promises';
import path from 'node:path';
import env from '@/configs/env';
import {
  extractScriptUrlsFromHtml,
} from '@/lib/capcutBundle/bundleExtractionUtils';
import {
  extractEditorBundleConfig,
  mergeEditorBundleConfig,
} from '@/lib/capcutBundle/bundleExtractors';
import logger from '@/services/logger';
import type { ApiRequester } from '@/types/api';
import type { CapCutBundleConfig } from '@/types/capcutBundle';

const bundleCacheTtlMs = 30 * 60 * 1000;

const defaultBundleConfig = (): CapCutBundleConfig => ({
  discoveredAt: 0,
  editor: {
    sourceUrls: [],
  },
});

const toAbsoluteUrl = (url: string) =>
  new URL(url, env.CAPCUT_WEB_URL).toString();

/**
 * CapCut の live bundle から設定値を抽出してキャッシュする
 */
class CapCutBundleService {
  private editorBundleConfig: CapCutBundleConfig['editor'] | null = null;

  private editorBundleDiscoveredAt = 0;

  private editorBundlePromise: Promise<CapCutBundleConfig['editor']> | null = null;

  /**
   * workspace / TTS 実行に足りる editor bundle 設定かを判定する
   */
  private hasUsableEditorBundleConfig(config: CapCutBundleConfig['editor']) {
    return (
      typeof config.editorAppVersion === 'string' &&
      /^\d+\.\d+\.\d+(?:-[A-Za-z0-9._-]+)?$/.test(config.editorAppVersion) &&
      (config.signRecipe?.pathTailLength ?? 0) >= 7
    );
  }

  /**
   * editor bundle 設定を返す
   */
  async resolveEditorBundleConfig(
    requester?: ApiRequester,
    forceRefresh = false
  ) {
    await this.loadBundleConfigFromFile();

    if (
      !forceRefresh &&
      this.editorBundleConfig &&
      Date.now() - this.editorBundleDiscoveredAt < bundleCacheTtlMs &&
      this.hasUsableEditorBundleConfig(this.editorBundleConfig)
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
    if (this.editorBundleConfig) {
      return;
    }

    try {
      const raw = await fs.readFile(env.CAPCUT_BUNDLE_CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw) as CapCutBundleConfig;

      this.editorBundleConfig = parsed.editor;
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
      discoveredAt: this.editorBundleDiscoveredAt,
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
            // bundle のファイル名ハッシュは再生成で変わるため固定しない
            /video_online\/static\/js\/(editor|services|vendors)|smart_tools_online\/static\/js\/tts/.test(
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

        if (this.hasUsableEditorBundleConfig(editorConfig)) {
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
