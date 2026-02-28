import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConverseCommand,
  type BedrockRuntimeClient,
  type Message,
  type SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { AwsClientFactory } from '../aws-client.factory';
import { AppEnv } from '../../config/env.validation';

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly awsClientFactory: AwsClientFactory,
  ) {
    this.client = this.awsClientFactory.createBedrockRuntimeClient();
    this.modelId = this.configService.get('AWS_BEDROCK_MODEL_ID', {
      infer: true,
    });
    this.maxTokens = this.configService.get('AWS_BEDROCK_MAX_TOKENS', {
      infer: true,
    });
    const tempStr = this.configService.get('AWS_BEDROCK_TEMPERATURE', {
      infer: true,
    });
    this.temperature = parseFloat(tempStr) || 0;
  }

  /**
   * 프롬프트 + 노트 + 전사 텍스트를 Nova Pro에 보내 회의록을 생성합니다.
   */
  async generateMeetingResult(params: {
    promptContent: string;
    noteContent: string;
    transcriptText: string;
    meetingTitle?: string;
  }): Promise<string> {
    const { promptContent, noteContent, transcriptText, meetingTitle } = params;

    const systemPrompt: SystemContentBlock[] = [
      {
        text: [
          '당신은 전문 회의록 작성 AI입니다.',
          '',
          '## 역할',
          '- 제공된 전사 데이터와 사용자 노트를 기반으로 정확하고 실행 가능한 구조화된 문서를 작성합니다.',
          '- 아래 [프롬프트 지시] 섹션에 정의된 출력 형식을 반드시 따릅니다.',
          '',
          '## 규칙',
          '- 반드시 한국어로 작성합니다.',
          '- 전사 데이터에 명시된 내용만 기록합니다. 전사에 없는 내용을 추론하거나 꾸며내지 않습니다.',
          '- 잡담, 인사, 일정 조율 같은 비핵심 내용은 제외합니다.',
          '- 담당자나 마감일이 명확하지 않으면 "미정"으로 표기합니다.',
          '- 안건이나 주제가 하나뿐이면 무리하게 분리하지 않습니다.',
          '- 개인 의견, 감정, 해석을 포함하지 않습니다.',
          '- 전사 데이터가 없으면 노트만으로 가능한 범위에서 작성합니다.',
          '- 출력은 반드시 Markdown 형식입니다.',
        ].join('\n'),
      },
    ];

    const userContent = this.buildUserContent({
      promptContent,
      noteContent,
      transcriptText,
      meetingTitle,
    });

    const messages: Message[] = [
      {
        role: 'user',
        content: [{ text: userContent }],
      },
    ];

    try {
      this.logger.log(
        `Invoking Bedrock model ${this.modelId} for meeting: ${meetingTitle ?? 'untitled'}`,
      );

      const command = new ConverseCommand({
        modelId: this.modelId,
        system: systemPrompt,
        messages,
        inferenceConfig: {
          maxTokens: this.maxTokens,
          temperature: this.temperature,
          topP: 1,
        },
      });

      const response = await this.client.send(command);

      const outputText = response.output?.message?.content?.[0]?.text ?? '';

      if (!outputText) {
        this.logger.warn('Bedrock returned empty response');
        return '';
      }

      this.logger.log(
        `Bedrock response received: ${outputText.length} chars, stop reason: ${response.stopReason}`,
      );

      return outputText;
    } catch (error) {
      this.logger.error(
        `Bedrock invocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private buildUserContent(params: {
    promptContent: string;
    noteContent: string;
    transcriptText: string;
    meetingTitle?: string;
  }): string {
    const { promptContent, noteContent, transcriptText, meetingTitle } = params;

    const sections: string[] = [];

    if (meetingTitle) {
      sections.push(`## 회의 제목\n${meetingTitle}`);
    }

    sections.push(`## 프롬프트 지시\n${promptContent}`);

    if (noteContent.trim()) {
      sections.push(`## 사용자 노트\n${noteContent}`);
    } else {
      sections.push('## 사용자 노트\n_작성된 노트가 없습니다._');
    }

    if (transcriptText.trim()) {
      // 토큰 제한 방어: 전사 텍스트가 너무 길면 뒤쪽 트리밍
      const maxTranscriptChars = 200_000; // 약 50K 토큰
      const trimmed =
        transcriptText.length > maxTranscriptChars
          ? transcriptText.slice(0, maxTranscriptChars) +
            '\n\n... (전사 텍스트가 길어 뒷부분이 생략되었습니다)'
          : transcriptText;
      sections.push(`## 전사 데이터\n${trimmed}`);
    } else {
      sections.push(
        '## 전사 데이터\n_수집된 전사 데이터가 없습니다. 노트 기반으로만 회의록을 생성하세요._',
      );
    }

    sections.push(
      '위 정보를 기반으로 프롬프트 지시에 따라 구조화된 회의록을 Markdown으로 작성하세요.',
    );

    return sections.join('\n\n');
  }
}
