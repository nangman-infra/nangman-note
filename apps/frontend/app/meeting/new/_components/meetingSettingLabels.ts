export const LANGUAGE_LABELS: Record<string, string> = {
  'ko-KR': '한국어',
  'en-US': '영어',
  'ja-JP': '일본어',
  'zh-CN': '중국어',
  'de-DE': '독일어',
  'fr-FR': '프랑스어',
  'es-ES': '스페인어',
};

export const TRANSLATE_LABELS: Record<string, string> = {
  ko: '한국어 번역',
  en: '영어 번역',
  ja: '일본어 번역',
  zh: '중국어 번역',
  de: '독일어 번역',
  fr: '프랑스어 번역',
  es: '스페인어 번역',
};

export function getLanguageLabel(languageCode: string): string {
  return languageCode ? (LANGUAGE_LABELS[languageCode] ?? languageCode) : '자동 감지';
}

export function getTranslateLabel(languageCode: string): string {
  return languageCode
    ? (TRANSLATE_LABELS[languageCode] ?? `${languageCode} 번역`)
    : '번역 없음';
}
