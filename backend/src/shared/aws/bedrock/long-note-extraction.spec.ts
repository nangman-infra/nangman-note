import * as fc from 'fast-check';
import { ConfigService } from '@nestjs/config';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { PromptDocumentType } from '../../../domain/prompt/domain/prompt-document-type.enum';
import { AwsClientFactory } from '../aws-client.factory';
import { AppEnv } from '../../config/env.validation';
import { BedrockService, BedrockMaxTokensError } from './bedrock.service';
import type { StructuredMeetingExtraction } from './bedrock.types';
import { splitNoteSources, splitSourceText } from './long-note-extraction';

function extraction(topics: string[]): StructuredMeetingExtraction {
  return {
    documentType: PromptDocumentType.MEETING,
    summary: '논의의 배경, 검토 내용과 결정을 기록합니다.',
    participants: ['지수'],
    agendaItems: topics.map((title) => ({
      title,
      discussionPoints: [`${title}: 수치와 대안의 비교 근거. `.repeat(30)],
      decisions: [`${title} 결정`],
      actionItems: [
        {
          task: `${title} 작업`,
          owner: '지수',
          deadline: '금요일',
          priority: 'High',
        },
      ],
      unresolved: [],
    })),
    overallDecisions: topics.map((title) => `${title} 결정`),
    followUps: [],
    keywords: [],
    uncertainties: [],
  };
}

const response = (value: unknown) => ({
  output: { message: { content: [{ text: JSON.stringify(value) }] } },
  stopReason: 'end_turn',
});

function setup() {
  const send = jest.fn();
  const config = {
    get: (key: string) =>
      key === 'AWS_BEDROCK_MAX_TOKENS' ? 4096 : 'test-model',
  } as unknown as ConfigService<AppEnv, true>;
  const factory = {
    createBedrockRuntimeClient: () => ({ send }),
  } as unknown as AwsClientFactory;
  return { service: new BedrockService(config, factory), send };
}

const input = (transcriptText: string, noteContent = '') => ({
  documentType: PromptDocumentType.MEETING,
  promptContent: '',
  noteContent,
  transcriptText,
});

function transcriptInput(command: ConverseCommand): string {
  const text = command.input.messages?.[0]?.content?.[0]?.text ?? '';
  return /```transcript-data\n([\s\S]*?)\n```/.exec(text)?.[1] ?? '';
}

describe('long-document coverage', () => {
  it('splits without dropping characters, newlines, or Unicode pairs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('한글', '😀', '\n', 'abc', '  '), {
          minLength: 1,
          maxLength: 500,
        }),
        fc.integer({ min: 2, max: 80 }),
        (pieces, limit) => {
          const text = pieces.join('');
          const chunks = splitSourceText(text, limit);
          expect(chunks.join('')).toBe(text);
          expect(
            chunks.every((chunk) => chunk.length <= limit && chunk.length > 0),
          ).toBe(true);
          expect(chunks.every((chunk) => !/[\uD800-\uDBFF]$/.test(chunk))).toBe(
            true,
          );
        },
      ),
    );
  });

  it('includes every part of long notes and transcripts exactly once as source data', () => {
    const noteContent = '노트 원문\n'.repeat(6_000);
    const transcriptText = '[1.0s ~ 2.0s] 전사 내용\n'.repeat(15_000);
    const chunks = splitNoteSources({ noteContent, transcriptText }, 8_000);
    expect(chunks.map((chunk) => chunk.noteContent).join('')).toBe(noteContent);
    expect(chunks.map((chunk) => chunk.transcriptText).join('')).toBe(
      transcriptText,
    );
    expect(
      chunks.every(
        (chunk) =>
          chunk.noteContent.length + chunk.transcriptText.length <= 8_000,
      ),
    ).toBe(true);
  });

  it('preserves all 24 topics, decisions and actions across a long recording', async () => {
    const { service, send } = setup();
    const source = Array.from(
      { length: 24 },
      (_, index) =>
        `[${index * 300}.0s ~ ${index * 300 + 299}.0s] 주제_${index}: ${'상세 논의 근거와 실제 예시입니다. '.repeat(80)}\n`,
    ).join('');
    let inFlight = 0;
    let maxInFlight = 0;
    send.mockImplementation(async (command: ConverseCommand) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      const topics = [...transcriptInput(command).matchAll(/주제_\d+/g)].map(
        (match) => match[0],
      );
      inFlight -= 1;
      return response(extraction(topics));
    });
    const result = (await service.extractStructuredNotes(
      input(source),
    )) as StructuredMeetingExtraction;
    expect(result.agendaItems.map((item) => item.title)).toEqual(
      Array.from({ length: 24 }, (_, index) => `주제_${index}`),
    );
    expect(result.overallDecisions).toHaveLength(24);
    expect(result.agendaItems.flatMap((item) => item.actionItems)).toHaveLength(
      24,
    );
    expect(result.agendaItems.at(-1)?.sourceLabel).toContain('전사 구간');
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(
      send.mock.calls.every(
        ([command]: [ConverseCommand]) =>
          (command.input.inferenceConfig?.maxTokens ?? 0) <= 4096,
      ),
    ).toBe(true);
  });

  it('does not truncate valid model output to 8 topics or 5/8/12/20 facts', async () => {
    const { service, send } = setup();
    const expected = extraction(
      Array.from({ length: 14 }, (_, i) => `주제${i}`),
    );
    expected.agendaItems[0].discussionPoints = Array.from(
      { length: 15 },
      (_, i) => `근거${i}`,
    );
    expected.agendaItems[0].actionItems = Array.from(
      { length: 25 },
      (_, i) => ({
        task: `작업${i}`,
        owner: '지수',
        deadline: '금요일',
        priority: 'Medium',
      }),
    );
    send.mockResolvedValue(response(expected));
    const result = (await service.extractStructuredNotes(
      input('회의 내용'),
    )) as StructuredMeetingExtraction;
    expect(result.agendaItems).toHaveLength(14);
    expect(result.agendaItems[0].discussionPoints).toHaveLength(15);
    expect(result.agendaItems[0].actionItems).toHaveLength(25);
    expect(result.overallDecisions).toHaveLength(14);
  });

  it('recovers max_tokens by shrinking only the failing source window', async () => {
    const { service, send } = setup();
    send
      .mockResolvedValueOnce({ stopReason: 'max_tokens' })
      .mockImplementation((command: ConverseCommand) =>
        Promise.resolve(
          response(
            extraction([
              transcriptInput(command).includes('앞주제') ? '앞주제' : '뒷주제',
            ]),
          ),
        ),
      );
    const source = `앞주제 ${'가'.repeat(2_000)}\n뒷주제 ${'나'.repeat(2_000)}`;
    const result = (await service.extractStructuredNotes(
      input(source),
    )) as StructuredMeetingExtraction;
    expect(send).toHaveBeenCalledTimes(3);
    expect(result.agendaItems.map((item) => item.title)).toEqual([
      '앞주제',
      '뒷주제',
    ]);
  });

  it('subdivides a suspiciously thin extraction without requiring invented topics', async () => {
    const { service, send } = setup();
    const thin = extraction(['하나의 주제']);
    thin.agendaItems[0].discussionPoints = ['짧은 한 줄'];
    send
      .mockResolvedValueOnce(response(thin))
      .mockResolvedValue(response(extraction(['하나의 주제'])));
    await service.extractStructuredNotes(
      input('실제 동일 주제의 설명. '.repeat(500)),
    );
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('does not silently accept a missing chunk or endlessly retry a tiny truncated response', async () => {
    const { service, send } = setup();
    send.mockResolvedValue({ stopReason: 'max_tokens' });
    await expect(
      service.extractStructuredNotes(input('짧은 내용')),
    ).rejects.toBeInstanceOf(BedrockMaxTokensError);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('prefers explicit topic transitions without dropping source text', () => {
    const source = `[0s ~ 30s] ${'가'.repeat(600)}\n[30s ~ 60s] [화자: 지수] 이제 다음 안건입니다. ${'나'.repeat(600)}`;
    const chunks = splitSourceText(source, 1_000, true);
    expect(chunks.join('')).toBe(source);
    expect(chunks[1]).toMatch(/^\[30s ~ 60s\]/);
  });

  it('synthesizes global metadata without replacing or dropping detailed topics', async () => {
    const { service, send } = setup();
    send.mockImplementation((command: ConverseCommand) => {
      if (!transcriptInput(command)) {
        return Promise.resolve(
          response({
            summary: '전체 구간을 반영한 통합 개요입니다.',
            suggestedTitle: '전체 세션 제목',
            agendaItems: [],
          }),
        );
      }
      return Promise.resolve(response(extraction(['구간별 상세 주제'])));
    });
    const result = (await service.extractStructuredNotes(
      input('가'.repeat(10_000)),
    )) as StructuredMeetingExtraction;
    expect(result.summary).toBe('전체 구간을 반영한 통합 개요입니다.');
    expect(result.suggestedTitle).toBe('전체 세션 제목');
    expect(result.agendaItems).toHaveLength(2);
  });
});
