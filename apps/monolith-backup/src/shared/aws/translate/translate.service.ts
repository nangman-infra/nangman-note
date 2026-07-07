import { Injectable } from '@nestjs/common';
import {
  TranslateClient,
  TranslateTextCommand,
} from '@aws-sdk/client-translate';
import { AwsClientFactory } from '../aws-client.factory';
import { StructuredLogger } from '../../logging/structured-logger';

export interface TranslateResult {
  translatedText: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
}

@Injectable()
export class TranslateService {
  private readonly logger = new StructuredLogger(TranslateService.name);
  private readonly client: TranslateClient;

  constructor(private readonly awsClientFactory: AwsClientFactory) {
    // AWS SDK v3 Translate 타입 해석 이슈로 no-unsafe-assignment 오탐 방지

    this.client = this.awsClientFactory.createTranslateClient();
  }

  /**
   * 텍스트 번역
   * @param text 번역할 텍스트
   * @param targetLanguage 타겟 언어 코드 (e.g. 'ko', 'en', 'ja')
   * @param sourceLanguage 소스 언어 코드 ('auto'이면 자동 감지)
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = 'auto',
  ): Promise<TranslateResult> {
    if (!text.trim()) {
      return {
        translatedText: '',
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: targetLanguage,
      };
    }

    try {
      // AWS SDK v3 Translate 타입 해석 이슈로 no-unsafe-assignment/no-unsafe-call 오탐 방지

      const command = new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: sourceLanguage,
        TargetLanguageCode: targetLanguage,
      });

      // AWS SDK v3 Translate 타입 해석 이슈로 no-unsafe-assignment/no-unsafe-call/no-unsafe-member-access 오탐 방지

      const response = (await this.client.send(command)) as {
        TranslatedText?: string;
        SourceLanguageCode?: string;
        TargetLanguageCode?: string;
      };

      return {
        translatedText: response.TranslatedText ?? text,
        sourceLanguageCode: response.SourceLanguageCode ?? sourceLanguage,
        targetLanguageCode: response.TargetLanguageCode ?? targetLanguage,
      };
    } catch (error) {
      this.logger.warn('translate.text.failed', {
        sourceLanguage,
        targetLanguage,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      // 번역 실패 시 원본 텍스트 반환 (서비스 중단 방지)
      return {
        translatedText: text,
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: targetLanguage,
      };
    }
  }

  /**
   * 소스 언어와 타겟 언어가 동일한지 확인
   * 동일하면 번역할 필요 없음
   */
  isSameLanguage(
    detectedLanguage: string | undefined,
    targetLanguage: string,
  ): boolean {
    if (!detectedLanguage) return false;
    // Transcribe는 'ko-KR' 형태, Translate는 'ko' 형태 → prefix 비교
    const sourceLang = detectedLanguage.split('-')[0].toLowerCase();
    const targetLang = targetLanguage.split('-')[0].toLowerCase();
    return sourceLang === targetLang;
  }
}
