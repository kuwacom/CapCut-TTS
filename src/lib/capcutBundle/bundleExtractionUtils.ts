/**
 * bundle 解析に使うユーティリティ
 */
export const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * HTML から script src を抽出する
 */
export const extractScriptUrlsFromHtml = (html: string) =>
  Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), (match) => match[1]);

/**
 * 変数代入から文字列値を探す
 */
export const extractStringAssignment = (text: string, variableName: string) => {
  const escapedVariableName = escapeRegExp(variableName);
  const pattern = new RegExp(
    `(?:let|const|var)\\s+${escapedVariableName}\\s*=\\s*["']([^"']+)["']`
  );
  return text.match(pattern)?.[1];
};

/**
 * 正規表現にヒットした最初の文字列を返す
 */
export const extractFirst = (text: string, pattern: RegExp) => text.match(pattern)?.[1];

/**
 * semver 風のバージョン文字列かを判定する
 * bundle 抽出値を constants のフォールバックに置き換える判断に使う
 */
export const isSemverLike = (value: string | undefined): value is string =>
  typeof value === 'string' &&
  /^\d+\.\d+\.\d+(?:-[A-Za-z0-9._-]+)?$/.test(value);
