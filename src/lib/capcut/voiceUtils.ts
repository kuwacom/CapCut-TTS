import { fallbackVoicePresets, voiceAliases } from '@/models/capcutVoiceModels';
import type { VoiceModel, VoicePreset } from '@/types/capcut';
import { parseNestedJsonRecord } from '@/lib/capcut/responseUtils';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  return null;
};

/**
 * CapCut の voice item から内部 VoicePreset へ変換する
 * extra と biz_extra の両方を見て title description speaker を拾う
 */
export const parseVoicePreset = (item: unknown): VoicePreset | null => {
  if (!isRecord(item)) {
    return null;
  }

  const commonAttr = isRecord(item.common_attr) ? item.common_attr : null;
  if (!commonAttr) {
    return null;
  }

  const extra = parseNestedJsonRecord(item.extra);
  const bizExtra = parseNestedJsonRecord(item.biz_extra);
  const voiceAlias =
    asString(extra?.voice_alias_name) ?? asString(bizExtra?.voice_alias_name);
  const title = asString(commonAttr.title);
  const speaker =
    JSON.stringify(item).match(/ICL_[A-Za-z0-9_]+|BV\d+_streaming|jp_\d+/)?.[0] ??
    null;
  const description =
    asString(commonAttr.description) ??
    voiceAlias ??
    speaker ??
    'CapCut voice preset';
  const effectId =
    asString(commonAttr.effect_id) ?? asString(commonAttr.id) ?? null;
  const resourceId =
    asString(commonAttr.third_resource_id_str) ??
    asString(commonAttr.third_resource_id) ??
    effectId;

  if (!title || !effectId || !resourceId || !speaker) {
    return null;
  }

  return {
    title,
    description,
    speaker,
    effectId,
    resourceId,
  };
};

/**
 * 利用可能モデル一覧向けに重複を除去して整形する
 */
export const toVoiceModels = (voices: VoicePreset[]): VoiceModel[] => {
  const seen = new Set<string>();

  return voices
    .filter((voice) => {
      if (seen.has(voice.resourceId)) {
        return false;
      }

      seen.add(voice.resourceId);
      return true;
    })
    .map((voice) => ({
      id: voice.resourceId,
      title: voice.title,
      description: voice.description,
      speaker: voice.speaker,
      effectId: voice.effectId,
      resourceId: voice.resourceId,
    }));
};

/**
 * type と voice 指定から使う VoicePreset を解決する
 */
export const resolveVoicePreset = (
  type: number | string,
  voices: VoicePreset[],
  requestedVoice?: string
) => {
  if (requestedVoice) {
    const normalizedVoice = requestedVoice.trim().toLowerCase();
    const targetVoice = voiceAliases[normalizedVoice] ?? normalizedVoice;
    const matchedVoice = voices.find(
      (voice) =>
        voice.effectId.toLowerCase() === targetVoice ||
        voice.resourceId.toLowerCase() === targetVoice ||
        voice.speaker.toLowerCase() === targetVoice ||
        voice.title.toLowerCase() === targetVoice
    );

    if (matchedVoice) {
      return matchedVoice;
    }

    const fallbackVoice = fallbackVoicePresets.find(
      (voice) =>
        voice.effectId.toLowerCase() === targetVoice ||
        voice.resourceId.toLowerCase() === targetVoice ||
        voice.speaker.toLowerCase() === targetVoice ||
        voice.title.toLowerCase() === targetVoice
    );

    if (fallbackVoice) {
      return fallbackVoice;
    }
  }

  if (typeof type === 'string') {
    const normalizedType = type.trim();

    if (/^\d+$/.test(normalizedType)) {
      const legacyIndex = Number(normalizedType);
      return (
        fallbackVoicePresets[legacyIndex] ??
        voices[legacyIndex] ??
        fallbackVoicePresets[0]
      );
    }

    const targetVoice = voiceAliases[normalizedType.toLowerCase()] ?? normalizedType;
    const matchedVoice = voices.find(
      (voice) =>
        voice.effectId.toLowerCase() === targetVoice.toLowerCase() ||
        voice.resourceId.toLowerCase() === targetVoice.toLowerCase() ||
        voice.speaker.toLowerCase() === targetVoice.toLowerCase() ||
        voice.title.toLowerCase() === targetVoice.toLowerCase()
    );

    if (matchedVoice) {
      return matchedVoice;
    }

    const fallbackVoice = fallbackVoicePresets.find(
      (voice) =>
        voice.effectId.toLowerCase() === targetVoice.toLowerCase() ||
        voice.resourceId.toLowerCase() === targetVoice.toLowerCase() ||
        voice.speaker.toLowerCase() === targetVoice.toLowerCase() ||
        voice.title.toLowerCase() === targetVoice.toLowerCase()
    );

    if (fallbackVoice) {
      return fallbackVoice;
    }
  }

  const legacyIndex = typeof type === 'number' ? type : 0;
  return (
    fallbackVoicePresets[legacyIndex] ??
    voices[legacyIndex] ??
    fallbackVoicePresets[0]
  );
};
