import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptEntity } from '../domain/prompt.entity';

const MEETING_PROMPT_CONTENT = [
  '# 역할',
  '당신은 기업 회의록 전문 작성자입니다. 제공된 전사 텍스트와 사용자 노트를 기반으로 정확하고 실행 가능한 회의록을 작성합니다.',
  '',
  '# 출력 형식',
  '',
  '반드시 아래 Markdown 구조를 따라 출력하세요. 섹션을 건너뛰지 마세요.',
  '',
  '## 회의 개요',
  '(전체 회의를 2~3문장으로 요약. 핵심 목적과 주요 결론 포함)',
  '',
  '## 안건별 논의',
  '',
  '### 안건 {번호}: {안건 제목}',
  '',
  '**핵심 논의:**',
  '- (주요 논의 내용 3~5개 불릿포인트)',
  '',
  '**결정사항:**',
  '- (확정된 결정. 없으면 "확정된 결정 없음")',
  '',
  '**액션 아이템:**',
  '- 작업: {내용} / 담당: {이름 또는 "미정"} / 마감: {날짜 또는 "미정"} / 우선순위: {High/Medium/Low}',
  '',
  '**미해결 사항:**',
  '- (다음 회의로 이관할 항목. 없으면 이 섹션 생략)',
  '',
  '(안건이 여러 개면 위 구조 반복)',
  '',
  '## 전체 요약',
  '**주요 결정:** (핵심 결정 3개 이내)',
  '**총 액션 아이템:** {N}개',
  '**후속 안건:** (이관 항목. 없으면 "없음")',
].join('\n');

const LECTURE_PROMPT_CONTENT = [
  '# 역할',
  '당신은 학습 정리 전문가입니다. 강의 전사 텍스트와 수강생 노트를 기반으로, 복습에 최적화된 학습노트를 작성합니다.',
  '',
  '# 출력 형식',
  '',
  '반드시 아래 Markdown 구조를 따라 출력하세요.',
  '',
  '## 강의 요약',
  '(전체 강의를 3~5문장으로 요약. 무엇을 배웠는지 핵심만)',
  '',
  '## 핵심 개념 (5~7개)',
  '',
  '### {번호}. {개념 이름}',
  '- **정의:** (1~2문장으로 설명)',
  '- **예시:** (강의에서 언급된 구체적 예시)',
  '- **핵심 포인트:** (기억해야 할 점 1~2개)',
  '',
  '(개념별 반복)',
  '',
  '## 실습 및 적용',
  '- (실습 내용, 과제, 적용 방법을 불릿포인트로)',
  '',
  '## 기억해야 할 5가지',
  '1. (가장 중요한 내용)',
  '2. ...',
  '3. ...',
  '4. ...',
  '5. ...',
].join('\n');

const SEMINAR_PROMPT_CONTENT = [
  '# 역할',
  '당신은 세미나/컨퍼런스 리포터입니다. 발표별로 핵심 메시지를 정리하고, Q&A와 인사이트를 구조화합니다.',
  '',
  '# 출력 형식',
  '',
  '반드시 아래 Markdown 구조를 따라 출력하세요.',
  '',
  '## 세미나 개요',
  '(세미나 전체 주제와 목적을 2~3문장으로 요약)',
  '',
  '## 발표별 정리',
  '',
  '### 발표 {번호}: {주제}',
  '**발표자:** {이름 또는 "미확인"}',
  '',
  '**주요 메시지:**',
  '- (핵심 내용 3~5개 불릿포인트)',
  '',
  '**근거/데이터:**',
  '- (발표에서 언급된 수치, 사례, 연구 결과)',
  '',
  '**인사이트:**',
  '- (새로운 관점이나 실용적 통찰 1~2개)',
  '',
  '(발표별 반복)',
  '',
  '## Q&A 정리',
  '- **Q:** {질문} → **A:** {답변 요약}',
  '',
  '(Q&A 없으면 "Q&A 세션 없음")',
  '',
  '## 핵심 인사이트 TOP 3',
  '1. (가장 중요한 인사이트)',
  '2. ...',
  '3. ...',
  '',
  '## 실행 가능한 아이디어',
  '- (세미나에서 얻은 실행 가능한 아이디어나 후속 조치)',
].join('\n');

const DEFAULT_PROMPTS: Array<Pick<PromptEntity, 'id' | 'name' | 'content'>> = [
  {
    id: 'prompt_default_meeting',
    name: '회의록',
    content: MEETING_PROMPT_CONTENT,
  },
  {
    id: 'prompt_default_lecture',
    name: '강의',
    content: LECTURE_PROMPT_CONTENT,
  },
  {
    id: 'prompt_default_seminar',
    name: '세미나',
    content: SEMINAR_PROMPT_CONTENT,
  },
];

@Injectable()
export class PromptService implements OnModuleInit {
  constructor(
    @InjectRepository(PromptEntity)
    private readonly promptRepository: Repository<PromptEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultPrompts();
  }

  async list(): Promise<{ default: PromptEntity[]; user: PromptEntity[] }> {
    const [defaultPrompts, userPrompts] = await Promise.all([
      this.promptRepository.find({
        where: { isDefault: true },
        order: { createdAt: 'ASC' },
      }),
      this.promptRepository.find({
        where: { isDefault: false },
        order: { createdAt: 'DESC' },
      }),
    ]);

    return {
      default: defaultPrompts,
      user: userPrompts,
    };
  }

  async findById(id: string): Promise<PromptEntity> {
    const prompt = await this.promptRepository.findOne({ where: { id } });

    if (!prompt) {
      throw new NotFoundException(`Prompt ${id} not found`);
    }

    return prompt;
  }

  async ensureExists(id: string): Promise<void> {
    const prompt = await this.promptRepository.findOne({ where: { id } });

    if (!prompt) {
      throw new BadRequestException(`Prompt ${id} does not exist`);
    }
  }

  async create(dto: CreatePromptDto): Promise<PromptEntity> {
    const prompt = this.promptRepository.create({
      id: `prompt_user_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      name: dto.name.trim(),
      content: dto.content.trim(),
      isDefault: false,
    });

    return this.promptRepository.save(prompt);
  }

  async update(id: string, dto: UpdatePromptDto): Promise<PromptEntity> {
    const existing = await this.findById(id);

    if (existing.isDefault) {
      throw new BadRequestException('Default prompts cannot be modified');
    }

    if (dto.name !== undefined) {
      existing.name = dto.name.trim();
    }

    if (dto.content !== undefined) {
      existing.content = dto.content.trim();
    }

    return this.promptRepository.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findById(id);

    if (existing.isDefault) {
      throw new BadRequestException('Default prompts cannot be deleted');
    }

    await this.promptRepository.delete({ id });
  }

  private async seedDefaultPrompts(): Promise<void> {
    const existingPrompts = await this.promptRepository.find({
      where: {},
      select: ['id', 'content', 'isDefault'],
    });
    const existingMap = new Map(
      existingPrompts.map((p) => [p.id, p]),
    );

    const toSave: PromptEntity[] = [];

    for (const defaultPrompt of DEFAULT_PROMPTS) {
      const existing = existingMap.get(defaultPrompt.id);

      if (!existing) {
        // 새로 생성
        toSave.push(
          this.promptRepository.create({
            ...defaultPrompt,
            isDefault: true,
          }),
        );
      } else if (
        existing.isDefault &&
        existing.content !== defaultPrompt.content
      ) {
        // 기본 프롬프트의 content가 변경되었으면 업데이트
        existing.content = defaultPrompt.content;
        toSave.push(existing as PromptEntity);
      }
    }

    if (toSave.length > 0) {
      await this.promptRepository.save(toSave);
    }
  }
}
