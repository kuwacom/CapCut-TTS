import { fallbackSpeakers, speakerAliases } from '@/models/capcutSpeakers';
import type { SpeakerInfo, Speaker } from '@/types/capcut';
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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (isRecord(value)) {
    return value;
  }

  return parseNestedJsonRecord(value);
};

const parseToneType = (
  record: Record<string, unknown> | null
): Record<string, unknown> | null => asRecord(record?.tonetype);

const ttsEffectType = 11;

// effect_type は TTS 音声が 11、ボイスエフェクト等の別素材がそれ以外になる
// TTS 以外の素材まで話者として受け入れると合成時に TTSInvalidSpeaker で落ちるため除外する
const isTtsEffectItem = (record: Record<string, unknown>): boolean => {
  const effectType = record.effect_type;

  return typeof effectType !== 'number' || effectType === ttsEffectType;
};

const legacySpeakerPattern = /^(?:ICL_[A-Za-z0-9_]+|BV\d+_streaming|jp_\d+)$/;

/**
 * CapCut の voice item から内部 Speaker へ変換する
 * extra と biz_extra の両方を見て title description speaker を拾う
 */
export const parseSpeaker = (item: unknown): Speaker | null => {
  if (!isRecord(item)) {
    return null;
  }

  const commonAttr = isRecord(item.common_attr) ? item.common_attr : null;
  if (!commonAttr) {
    return null;
  }

  if (!isTtsEffectItem(commonAttr)) {
    return null;
  }

  const extra = asRecord(commonAttr.extra) ?? asRecord(item.extra);
  const bizExtra = asRecord(commonAttr.biz_extra) ?? asRecord(item.biz_extra);
  const toneType = parseToneType(extra) ?? parseToneType(bizExtra);
  const timbre = asRecord(item.timbre);
  const voiceAlias =
    asString(extra?.voice_alias_name) ?? asString(bizExtra?.voice_alias_name);
  const title = asString(commonAttr.title);
  const speaker =
    asString(toneType?.voice_type) ??
    asString(toneType?.tts_voice) ??
    asString(extra?.ttp_voice_type) ??
    asString(bizExtra?.ttp_voice_type) ??
    asString(timbre?.voice_type) ??
    asString(timbre?.voice);
  const tonePlatform =
    asString(toneType?.platform) ??
    asString(extra?.tone_platform) ??
    asString(bizExtra?.tone_platform);
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

  if (!title || !effectId || !resourceId) {
    return null;
  }

  return {
    title,
    description,
    ...(speaker ? { speaker } : {}),
    effectId,
    resourceId,
    ...(tonePlatform === '11labs' ? { ttsPlatform: 2 } : {}),
    ...(extra?.is_vip === true ? { isVip: true } : {}),
    style: '',
    language: speaker ? envLanguageFromSpeaker(speaker) : 'unknown',
  };
};

const envLanguageFromSpeaker = (speaker: string): string => {
  const match = speaker.match(/^(?:ICL_)?([a-z]{2})[_-]/i);
  return match?.[1]?.toLowerCase() ?? 'unknown';
};

/**
 * 利用可能話者一覧向けに重複を除去して整形する
 */
export const toSpeakerInfoList = (speakers: Speaker[]): SpeakerInfo[] => {
  const seen = new Set<string>();

  return speakers
    .filter((resolvedSpeaker) => {
      if (seen.has(resolvedSpeaker.resourceId)) {
        return false;
      }

      seen.add(resolvedSpeaker.resourceId);
      return true;
    })
    .map((resolvedSpeaker) => ({
      id: resolvedSpeaker.speaker ?? resolvedSpeaker.resourceId,
      speaker: resolvedSpeaker.speaker,
      resourceId: resolvedSpeaker.resourceId,
      effectId: resolvedSpeaker.effectId,
      name: resolvedSpeaker.title,
      description: resolvedSpeaker.description,
      style: resolvedSpeaker.style || '',
      language:
        resolvedSpeaker.language ||
        (resolvedSpeaker.speaker
          ? envLanguageFromSpeaker(resolvedSpeaker.speaker)
          : 'unknown'),
      isVip: resolvedSpeaker.isVip ?? false,
    }));
};

const findSpeaker = (
  targetSpeaker: string,
  speakers: Speaker[]
): Speaker | undefined => {
  const normalizedTarget = targetSpeaker.toLowerCase();

  return speakers.find(
    (resolvedSpeaker) =>
      resolvedSpeaker.effectId.toLowerCase() === normalizedTarget ||
      resolvedSpeaker.resourceId.toLowerCase() === normalizedTarget ||
      resolvedSpeaker.speaker?.toLowerCase() === normalizedTarget ||
      resolvedSpeaker.title.toLowerCase() === normalizedTarget
  );
};

export const supportsMultiPlatformSpeaker = (speaker?: string): boolean =>
  Boolean(speaker && legacySpeakerPattern.test(speaker));

/**
 * speaker と type 指定から使う Speaker を解決する
 */
export const resolveSpeaker = (
  type: number | string,
  speakers: Speaker[],
  requestedSpeaker?: string
): Speaker => {
  if (requestedSpeaker) {
    const normalizedSpeaker = requestedSpeaker.trim().toLowerCase();
    const targetSpeaker =
      speakerAliases[normalizedSpeaker] ?? normalizedSpeaker;
    const matchedSpeaker =
      findSpeaker(targetSpeaker, speakers) ??
      findSpeaker(targetSpeaker, fallbackSpeakers);

    if (matchedSpeaker) {
      return matchedSpeaker;
    }
  }

  if (typeof type === 'string') {
    const normalizedType = type.trim();

    if (/^\d+$/.test(normalizedType)) {
      const legacyIndex = Number(normalizedType);
      return (
        fallbackSpeakers[legacyIndex] ??
        speakers[legacyIndex] ??
        fallbackSpeakers[0]
      );
    }

    const targetSpeaker =
      speakerAliases[normalizedType.toLowerCase()] ?? normalizedType;
    const matchedSpeaker =
      findSpeaker(targetSpeaker, speakers) ??
      findSpeaker(targetSpeaker, fallbackSpeakers);

    if (matchedSpeaker) {
      return matchedSpeaker;
    }
  }

  const legacyIndex = typeof type === 'number' ? type : 0;
  return (
    fallbackSpeakers[legacyIndex] ??
    speakers[legacyIndex] ??
    fallbackSpeakers[0]
  );
};
