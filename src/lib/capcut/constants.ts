/**
 * CapCut 固定値群
 * HAR と実通信から確認できた値だけを集約している
 */
export const capCutConstants = {
  appId: '348188',
  loginSdkVersion: '2.1.10-tiktok',
  webAppVersion: '5.8.0',
  // 2026-10 の editor bundle が署名付きリクエストで送っている appvr に合わせている
  editorAppVersion: '5.8.0',
  platformId: '7',
  signVersion: '1',
  voicePanel: 'tone',
  voicePanelSource: 'heycan',
  ttsSmartToolType: 39,
  ttsScene: 3,
  ttsPlatform: 1,
  voiceCacheMs: 10 * 60 * 1000,
  sessionValidateMs: 10 * 60 * 1000,
  ttsPollIntervalMs: 700,
  ttsMaxPollAttempts: 30,
};
