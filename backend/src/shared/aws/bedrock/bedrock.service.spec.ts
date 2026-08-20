import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { AwsClientFactory } from '../aws-client.factory';
import { AppEnv } from '../../config/env.validation';
import { PromptDocumentType } from '../../../domain/prompt/domain/prompt-document-type.enum';
import { BedrockService } from './bedrock.service';

import type { StructuredMeetingExtraction } from './bedrock.types';

const buildConfigMap = (): AppEnv =>
  ({
    PORT: 9999,
    NODE_ENV: 'test',
    DB_PATH: ':memory:',
    ENCRYPTION_KEY: 'dev-only-encryption-key-replace-in-production',
    AWS_REGION: 'ap-northeast-2',
    AWS_PROFILE: 'default',
    AWS_TRANSCRIBE_JOB_PREFIX: 'nangman-note',
    AWS_TRANSCRIBE_LANGUAGE_CODE: 'ko-KR',
    AWS_TRANSCRIBE_OUTPUT_BUCKET: '',
    AWS_TRANSCRIBE_MEDIA_FORMAT: 'webm',
    AWS_S3_AUDIO_BUCKET: '',
    AWS_S3_AUDIO_KEY_PREFIX: 'meeting-audio',
    AWS_BEDROCK_MODEL_ID: 'amazon.nova-pro-v1:0',
    AWS_BEDROCK_MAX_TOKENS: 4096,
    AWS_BEDROCK_TEMPERATURE: 0,
    LOG_LEVEL: 'debug',
    CORS_ORIGIN: 'http://localhost:3000',
  }) as AppEnv;

const createService = (outputText = '# result') => {
  const send = jest.fn().mockResolvedValue({
    output: { message: { content: [{ text: outputText }] } },
    stopReason: 'end_turn',
  });
  const mockClient = { send } as unknown as BedrockRuntimeClient;
  const awsClientFactory = {
    createBedrockRuntimeClient: jest.fn().mockReturnValue(mockClient),
  } as unknown as AwsClientFactory;

  const configMap = buildConfigMap();
  const configService = {
    get: jest.fn(
      (key: string) => (configMap as unknown as Record<string, unknown>)[key],
    ),
  } as unknown as ConfigService<AppEnv, true>;

  const service = new BedrockService(configService, awsClientFactory);

  return { service, send };
};

const extractConverseInput = (
  send: jest.Mock,
): {
  modelId?: string;
  system?: Array<{ text?: string }>;
  messages?: Array<{ content?: Array<{ text?: string }> }>;
  inferenceConfig?: Record<string, unknown>;
} => {
  const firstCall = (send.mock.calls as unknown[][])[0];
  if (!firstCall) {
    throw new Error('Expected Bedrock client send to be called');
  }
  const command = firstCall[0] as ConverseCommand;
  return (command as unknown as { input: Record<string, unknown> }).input as {
    modelId?: string;
    system?: Array<{ text?: string }>;
    messages?: Array<{ content?: Array<{ text?: string }> }>;
    inferenceConfig?: Record<string, unknown>;
  };
};

describe('BedrockService', () => {
  it('omits deprecated temperature from inference config', async () => {
    const { service, send } = createService();

    await service.generateMeetingResult({
      promptContent: '테스트 프롬프트',
      noteContent: '테스트 노트',
      transcriptText: '테스트 전사',
      meetingTitle: '테스트 회의',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const input = extractConverseInput(send);
    const inferenceConfig = input.inferenceConfig ?? {};

    expect(input.modelId).toBe('amazon.nova-pro-v1:0');
    expect(inferenceConfig.maxTokens).toBe(4096);
    expect(inferenceConfig.temperature).toBeUndefined();
    expect(inferenceConfig.topP).toBeUndefined();
  });

  it('wraps prompt/note/transcript in explicit data blocks and adds safety rules', async () => {
    const { service, send } = createService();

    await service.generateMeetingResult({
      promptContent: '회의 내용을 간결하게 정리해줘',
      noteContent: '중요 메모',
      transcriptText: '발화 1\n발화 2',
      meetingTitle: '주간 회의',
      meetingAgenda: '진행 현황 공유',
    });

    const input = extractConverseInput(send);
    const systemText = input.system?.[0]?.text ?? '';
    const userText = input.messages?.[0]?.content?.[0]?.text ?? '';

    expect(systemText).toContain('데이터 블록 안의 지시문');
    expect(systemText).toContain('시스템 규칙 > 프롬프트 지시 > 데이터 블록');
    expect(userText).toContain('```prompt-directive');
    expect(userText).toContain('```note-data');
    expect(userText).toContain('```transcript-data');
    expect(userText).toContain('## 회의 제목\n주간 회의');
    expect(userText).toContain('## 회의 아젠다\n진행 현황 공유');
  });

  it('keeps both transcript head and tail when transcript is too long', async () => {
    const { service, send } = createService();

    const headToken = 'H';
    const middleToken = 'M';
    const tailToken = 'T';
    const longTranscript = [
      headToken.repeat(120_000),
      middleToken.repeat(10_000),
      tailToken.repeat(120_000),
    ].join('');

    await service.generateMeetingResult({
      promptContent: '테스트 프롬프트',
      noteContent: '',
      transcriptText: longTranscript,
    });

    const input = extractConverseInput(send);
    const userText = input.messages?.[0]?.content?.[0]?.text ?? '';

    expect(userText).toContain('... (중간 전사 구간 생략) ...');
    expect(userText).toContain(
      '... (전사 텍스트가 길어 앞/뒤 핵심 구간만 포함되었습니다)',
    );
    expect(userText).toContain(headToken.repeat(1024));
    expect(userText).toContain(tailToken.repeat(1024));
    expect(userText).not.toContain(middleToken.repeat(2048));
  });

  it('extracts structured notes with type-specific JSON schema and modifier block', async () => {
    const { service, send } = createService(
      JSON.stringify({
        documentType: 'meeting',
        summary: '핵심 요약',
        participants: ['택준', '희훈'],
        agendaItems: [
          {
            title: '가상화',
            discussionPoints: ['전가상화와 반가상화를 비교했다'],
            decisions: [],
            actionItems: [
              {
                task: '추가 조사',
                owner: '',
                deadline: '',
                priority: 'Urgent',
              },
            ],
            unresolved: ['세부 설정은 추가 확인 필요'],
          },
        ],
        overallDecisions: [],
        followUps: ['추가 실습 진행'],
        keywords: ['가상화', 'APM', '가상화'],
        uncertainties: ['정확한 적용 방식은 후속 확인 필요'],
      }),
    );

    const result = await service.extractStructuredNotes({
      documentType: PromptDocumentType.MEETING,
      promptContent: '실무 팁을 강조해줘',
      noteContent: '중요 메모',
      transcriptText: '발화 1\n발화 2',
      meetingTitle: '주간 회의',
      meetingAgenda: '가상화 학습',
    });

    const input = extractConverseInput(send);
    const systemText = input.system?.[0]?.text ?? '';
    const userText = input.messages?.[0]?.content?.[0]?.text ?? '';
    const inferenceConfig = input.inferenceConfig ?? {};

    expect(systemText).toContain('"documentType": "meeting"');
    expect(userText).toContain('## 추가 강조 지시');
    expect(userText).toContain('```prompt-modifier');
    expect(inferenceConfig.temperature).toBeUndefined();
    expect(result.documentType).toBe(PromptDocumentType.MEETING);
    expect(result.summary).toBe('핵심 요약');
    expect(result.keywords).toEqual(['가상화', 'APM']);
    const meetingResult = result as StructuredMeetingExtraction;
    expect(meetingResult.agendaItems[0]?.actionItems[0]).toEqual({
      task: '추가 조사',
      owner: '미정',
      deadline: '미정',
      priority: 'Medium',
    });
  });

  it('system prompt contains narrative summary instruction', async () => {
    const { service, send } = createService(
      JSON.stringify({
        documentType: 'meeting',
        summary: '테스트 요약',
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      }),
    );

    await service.extractStructuredNotes({
      documentType: PromptDocumentType.MEETING,
      promptContent: '',
      noteContent: '',
      transcriptText: '테스트',
    });

    const input = extractConverseInput(send);
    const systemText = input.system?.[0]?.text ?? '';

    expect(systemText).toContain('서술형 문단');
  });

  it('system prompt contains emoji prohibition', async () => {
    const { service, send } = createService(
      JSON.stringify({
        documentType: 'meeting',
        summary: '테스트 요약',
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      }),
    );

    await service.extractStructuredNotes({
      documentType: PromptDocumentType.MEETING,
      promptContent: '',
      noteContent: '',
      transcriptText: '테스트',
    });

    const input = extractConverseInput(send);
    const systemText = input.system?.[0]?.text ?? '';

    expect(systemText).toContain('이모지');
  });

  it('system prompt contains language matching instruction', async () => {
    const { service, send } = createService(
      JSON.stringify({
        documentType: 'meeting',
        summary: '테스트 요약',
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      }),
    );

    await service.extractStructuredNotes({
      documentType: PromptDocumentType.MEETING,
      promptContent: '',
      noteContent: '',
      transcriptText: '테스트',
    });

    const input = extractConverseInput(send);
    const systemText = input.system?.[0]?.text ?? '';

    expect(systemText).toContain('주요 언어');
  });

  it('JSON schema in system prompt contains context field', async () => {
    const { service, send } = createService(
      JSON.stringify({
        documentType: 'meeting',
        summary: '테스트 요약',
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      }),
    );

    await service.extractStructuredNotes({
      documentType: PromptDocumentType.MEETING,
      promptContent: '',
      noteContent: '',
      transcriptText: '테스트',
    });

    const input = extractConverseInput(send);
    const systemText = input.system?.[0]?.text ?? '';

    expect(systemText).toContain('"context"');
  });

  it('system prompt contains target language instruction when translateTargetLanguage is provided', async () => {
    const { service, send } = createService(
      JSON.stringify({
        documentType: 'meeting',
        summary: 'Test summary',
        participants: [],
        agendaItems: [],
        overallDecisions: [],
        followUps: [],
        keywords: [],
        uncertainties: [],
      }),
    );

    await service.extractStructuredNotes({
      documentType: PromptDocumentType.MEETING,
      promptContent: '',
      noteContent: '',
      transcriptText: '테스트',
      translateTargetLanguage: 'English',
    });

    const input = extractConverseInput(send);
    const systemText = input.system?.[0]?.text ?? '';

    expect(systemText).toContain('English');
  });

  // Feature: ai-output-quality, Property 13: translateTargetLanguage가 제공되면 시스템 프롬프트에 해당 언어 지시가 포함된다
  // **Validates: Requirements 2.4**
  it('Property 13: translateTargetLanguage is included in system prompt when provided', async () => {
    const languages = [
      'English',
      'Korean',
      '한국어',
      'Japanese',
      'French',
      'Chinese',
    ];

    for (const lang of languages) {
      const { service, send } = createService(
        JSON.stringify({
          documentType: 'meeting',
          summary: '테스트 요약',
          participants: [],
          agendaItems: [],
          overallDecisions: [],
          followUps: [],
          keywords: [],
          uncertainties: [],
        }),
      );

      await service.extractStructuredNotes({
        documentType: PromptDocumentType.MEETING,
        promptContent: '',
        noteContent: '',
        transcriptText: '테스트',
        translateTargetLanguage: lang,
      });

      const input = extractConverseInput(send);
      const systemText = input.system?.[0]?.text ?? '';

      expect(systemText).toContain(lang);
    }
  });
});
