/**
 * CapCut の sign 生成式を表す
 */
export interface CapCutSignRecipe {
  prefix: string;
  suffix: string;
  pathTailLength: number;
  platformId?: string;
  signVersion?: string;
  tdidDefault?: string;
}

/**
 * editor bundle から得られる設定
 */
export interface CapCutEditorBundleConfig {
  sourceUrls: string[];
  editorAppVersion?: string;
  webAppVersion?: string;
  versionName?: string;
  versionCode?: string;
  sdkVersion?: string;
  effectSdkVersion?: string;
  signRecipe?: Partial<CapCutSignRecipe>;
  multiPlatformPath?: string;
  createTaskPath?: string;
  queryTaskPath?: string;
  workspacePath?: string;
  voiceListPath?: string;
  voicePanelSource?: string;
  voiceCategoryIds?: number[];
}

/**
 * 抽出済み bundle 設定の全体像
 */
export interface CapCutBundleConfig {
  discoveredAt: number;
  editor: CapCutEditorBundleConfig;
}
