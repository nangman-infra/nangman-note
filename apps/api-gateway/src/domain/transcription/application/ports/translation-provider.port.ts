export const TRANSLATION_PROVIDER = Symbol('TRANSLATION_PROVIDER');

export interface TranslationResult {
  translatedText: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
}

export interface TranslationProvider {
  translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<TranslationResult>;
  isSameLanguage(
    detectedLanguage: string | undefined,
    targetLanguage: string,
  ): boolean;
}
