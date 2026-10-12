import type {
  CapCutEditorBundleConfig,
  CapCutSignRecipe,
} from '@/types/capcutBundle';
import {
  extractFirst,
} from '@/lib/capcutBundle/bundleExtractionUtils';

const mergeSignRecipe = (
  base: Partial<CapCutSignRecipe> | undefined,
  next: Partial<CapCutSignRecipe> | undefined
) => {
  if (!base) {
    return next;
  }

  if (!next) {
    return base;
  }

  return {
    ...base,
    ...next,
  };
};

const preferLongerPath = (
  current: string | undefined,
  next: string | undefined
) => {
  if (!current) {
    return next;
  }

  if (!next) {
    return current;
  }

  return next.length >= current.length ? next : current;
};

/**
 * editor bundle から抽出可能な設定を抜く
 */
export const extractEditorBundleConfig = (
  bundleText: string,
  bundleUrl?: string
): CapCutEditorBundleConfig => {
  let signRecipe: Partial<CapCutSignRecipe> | undefined;

  if (bundleText.includes('9e2c|') && bundleText.includes('11ac')) {
    const pathTailLengthMatch = bundleText.match(/slice\(-(\d+)\)/);
    const platformIdMatch =
      bundleText.match(/pf:"(\d+)"/) ??
      bundleText.match(/pf='(\d+)'/) ??
      bundleText.match(/u\.pf="(\d+)"/);
    const signVersionMatch =
      bundleText.match(/["']sign-ver["']:(\d+)/) ??
      bundleText.match(/["']sign-ver["']=(\d+)/);
    const tdidDefaultMatch =
      bundleText.match(/tdid:"([^"]*)"/) ??
      bundleText.match(/tdid='([^']*)'/);

    signRecipe = {
      prefix: '9e2c',
      suffix: '11ac',
      pathTailLength: pathTailLengthMatch ? Number(pathTailLengthMatch[1]) : 7,
      platformId: platformIdMatch?.[1],
      signVersion: signVersionMatch?.[1],
      tdidDefault: tdidDefaultMatch?.[1],
    };
  }

  // 現行 bundle では version_name が変数フォールバックになり抽出できないため
  // artist API パラメータの version_code リテラルを両方に流用する
  // 単純な version_code 検索だと editor 内部の別バージョンを拾うため文脈で固定する
  const versionCode = extractFirst(
    bundleText,
    /version_code:"(\d+\.\d+\.\d+)",sdk_version:null!=/
  );
  const versionName = versionCode;
  const editorAppVersion =
    // 署名付きリクエストのヘッダーに直接埋め込まれるリテラルを優先する
    extractFirst(bundleText, /appvr:"(\d+\.\d+\.\d+)"/) ??
    extractFirst(bundleText, /appvr=([0-9]+\.[0-9]+\.[0-9]+)/);
  // cc_web 環境定数オブジェクトから Web アプリのバージョンを取る
  const webAppVersion = extractFirst(
    bundleText,
    /APP_NAME:"cc_web"[^}]*?VERSION:"(\d+\.\d+\.\d+)"/
  );

  const voiceCategoryIds = Array.from(
    new Set(
      Array.from(
        bundleText.matchAll(/right_category\\?":\\?"(\d{4,})/g),
        (match) => Number(match[1])
      ).filter((value) => Number.isFinite(value))
    )
  );

  // homepageEffectListPath は現行 bundle から抽出できても消費者がないため保持しない
  return {
    sourceUrls: bundleUrl ? [bundleUrl] : [],
    editorAppVersion,
    webAppVersion,
    versionName,
    versionCode,
    signRecipe,
    multiPlatformPath: extractFirst(
      bundleText,
      /["'](\/storyboard\/v1\/tts\/multi_platform)["']/
    ),
    createTaskPath:
      extractFirst(
        bundleText,
        /["'](\/lv\/v2\/intelligence\/create)["']/
      ) ?? extractFirst(bundleText, /CREATE_VC_TASK:"([^"]+)"/),
    queryTaskPath:
      extractFirst(
        bundleText,
        /["'](\/lv\/v2\/intelligence\/query)["']/
      ) ?? extractFirst(bundleText, /QUERY_VC_TASK:"([^"]+)"/),
    workspacePath:
      extractFirst(
        bundleText,
        /["'](\/cc\/v1\/workspace\/get_user_workspaces)["']/
      ) ?? undefined,
    voiceListPath:
      extractFirst(
        bundleText,
        /GET_HEYCAN_RESOURCES_BY_CATEGORY_ID:\{[^}]*url:"([^"]+)"/
      ) ?? extractFirst(bundleText, /GET_CATEGORY_RESOURCE:"([^"]+)"/),
    voicePanelSource: bundleText.includes('heycan') ? 'heycan' : undefined,
    voiceCategoryIds,
  };
};

/**
 * editor 設定を後勝ちでマージする
 */
export const mergeEditorBundleConfig = (
  current: CapCutEditorBundleConfig,
  next: CapCutEditorBundleConfig
): CapCutEditorBundleConfig => ({
  sourceUrls: Array.from(new Set([...current.sourceUrls, ...next.sourceUrls])),
  editorAppVersion: next.editorAppVersion ?? current.editorAppVersion,
  webAppVersion: next.webAppVersion ?? current.webAppVersion,
  versionName: next.versionName ?? current.versionName,
  versionCode: next.versionCode ?? current.versionCode,
  sdkVersion: next.sdkVersion ?? current.sdkVersion,
  effectSdkVersion: next.effectSdkVersion ?? current.effectSdkVersion,
  signRecipe: mergeSignRecipe(current.signRecipe, next.signRecipe),
  multiPlatformPath: preferLongerPath(
    current.multiPlatformPath,
    next.multiPlatformPath
  ),
  createTaskPath: preferLongerPath(current.createTaskPath, next.createTaskPath),
  queryTaskPath: preferLongerPath(current.queryTaskPath, next.queryTaskPath),
  workspacePath: preferLongerPath(current.workspacePath, next.workspacePath),
  voiceListPath: preferLongerPath(current.voiceListPath, next.voiceListPath),
  voicePanelSource: next.voicePanelSource ?? current.voicePanelSource,
  voiceCategoryIds:
    next.voiceCategoryIds && next.voiceCategoryIds.length > 0
      ? Array.from(
          new Set([...(current.voiceCategoryIds ?? []), ...next.voiceCategoryIds])
        )
      : current.voiceCategoryIds,
});

