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

const DEFAULT_PROMPTS: Array<Pick<PromptEntity, 'id' | 'name' | 'content'>> = [
  {
    id: 'prompt_default_meeting',
    name: '회의록',
    content:
      '안건별 핵심 논의, 결정사항, 액션 아이템(담당자/마감일)을 구조화해서 작성하세요.',
  },
  {
    id: 'prompt_default_lecture',
    name: '강의',
    content: '핵심 개념, 예시, 실습 포인트를 학습노트 형태로 정리하세요.',
  },
  {
    id: 'prompt_default_seminar',
    name: '세미나',
    content: '발표자별 주요 메시지, Q&A, 인사이트를 중심으로 정리하세요.',
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
    const existingIds = new Set(
      (
        await this.promptRepository.find({
          where: {},
          select: ['id'],
        })
      ).map((prompt) => prompt.id),
    );

    const missing = DEFAULT_PROMPTS.filter(
      (prompt) => !existingIds.has(prompt.id),
    );

    if (missing.length === 0) {
      return;
    }

    await this.promptRepository.save(
      missing.map((prompt) =>
        this.promptRepository.create({
          ...prompt,
          isDefault: true,
        }),
      ),
    );
  }
}
