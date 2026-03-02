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
import { DEFAULT_PROMPTS } from '../domain/default-prompts';
import { PromptEntity } from '../domain/prompt.entity';

@Injectable()
export class PromptService implements OnModuleInit {
  constructor(
    @InjectRepository(PromptEntity)
    private readonly promptRepository: Repository<PromptEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultPrompts();
  }

  async list(
    ownerSub?: string,
  ): Promise<{ default: PromptEntity[]; user: PromptEntity[] }> {
    const [defaultPrompts, userPrompts] = await Promise.all([
      this.promptRepository.find({
        where: { isDefault: true },
        order: { createdAt: 'ASC' },
      }),
      this.promptRepository.find({
        where: ownerSub ? { isDefault: false, ownerSub } : { isDefault: false },
        order: { createdAt: 'DESC' },
      }),
    ]);

    return {
      default: defaultPrompts,
      user: userPrompts,
    };
  }

  async findById(id: string, ownerSub?: string): Promise<PromptEntity> {
    const prompt = await this.promptRepository.findOne({
      where: ownerSub
        ? [
            { id, isDefault: true },
            { id, ownerSub },
          ]
        : { id },
    });

    if (!prompt) {
      throw new NotFoundException(`Prompt ${id} not found`);
    }

    return prompt;
  }

  async ensureExists(id: string, ownerSub?: string): Promise<void> {
    const prompt = await this.promptRepository.findOne({
      where: ownerSub
        ? [
            { id, isDefault: true },
            { id, ownerSub },
          ]
        : { id },
    });

    if (!prompt) {
      throw new BadRequestException(`Prompt ${id} does not exist`);
    }
  }

  async create(dto: CreatePromptDto, ownerSub?: string): Promise<PromptEntity> {
    const prompt = this.promptRepository.create({
      id: `prompt_user_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      ownerSub: ownerSub?.trim() || undefined,
      name: dto.name.trim(),
      content: dto.content.trim(),
      isDefault: false,
    });

    return this.promptRepository.save(prompt);
  }

  async update(
    id: string,
    dto: UpdatePromptDto,
    ownerSub?: string,
  ): Promise<PromptEntity> {
    const existing = await this.findById(id, ownerSub);

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

  async remove(id: string, ownerSub?: string): Promise<void> {
    const existing = await this.findById(id, ownerSub);

    if (existing.isDefault) {
      throw new BadRequestException('Default prompts cannot be deleted');
    }

    await this.promptRepository.delete(ownerSub ? { id, ownerSub } : { id });
  }

  private async seedDefaultPrompts(): Promise<void> {
    // ON CONFLICT 기반 upsert로 멀티 인스턴스 동시 기동에도 안전하게 시드합니다.
    await this.promptRepository.upsert(
      DEFAULT_PROMPTS.map((prompt) => ({
        ...prompt,
        isDefault: true,
      })),
      ['id'],
    );
  }
}
