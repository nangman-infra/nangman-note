import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DEFAULT_PROMPTS } from '../domain/default-prompts';
import { PromptDocumentType } from '../domain/prompt-document-type.enum';
import { PromptEntity } from '../domain/prompt.entity';
import { PromptService } from './prompt.service';

describe('PromptService', () => {
  let service: PromptService;
  let promptRepository: jest.Mocked<
    Pick<
      Repository<PromptEntity>,
      'create' | 'save' | 'find' | 'findOne' | 'delete' | 'upsert'
    >
  >;

  const buildPrompt = (overrides: Partial<PromptEntity> = {}): PromptEntity =>
    ({
      id: 'prompt_user_123',
      name: '사용자 프롬프트',
      content: '내용',
      documentType: PromptDocumentType.MEETING,
      isDefault: false,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      ...overrides,
    }) as unknown as PromptEntity;

  beforeEach(() => {
    promptRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    };

    service = new PromptService(
      promptRepository as unknown as Repository<PromptEntity>,
    );
  });

  it('seeds default prompts with idempotent upsert on module init', async () => {
    promptRepository.upsert.mockResolvedValue({
      generatedMaps: [],
      identifiers: [],
      raw: [],
    } as never);

    await service.onModuleInit();

    expect(promptRepository.upsert).toHaveBeenCalledTimes(1);
    expect(promptRepository.upsert).toHaveBeenCalledWith(
      DEFAULT_PROMPTS.map((prompt) => ({
        ...prompt,
        isDefault: true,
      })),
      ['id'],
    );
  });

  it('create trims fields and forces isDefault=false', async () => {
    const created = buildPrompt({
      id: 'prompt_user_abcd1234',
      name: 'trimmed name',
      content: 'trimmed content',
      isDefault: false,
    });
    promptRepository.create.mockReturnValue(created);
    promptRepository.save.mockResolvedValue(created);

    const result = await service.create({
      name: '  trimmed name  ',
      content: '  trimmed content  ',
      documentType: PromptDocumentType.LECTURE,
    });

    expect(promptRepository.create).toHaveBeenCalledTimes(1);
    const createArg = promptRepository.create.mock.calls[0][0] as {
      id: string;
      name: string;
      content: string;
      documentType: PromptDocumentType;
      isDefault: boolean;
    };
    expect(createArg.id).toMatch(/^prompt_user_/);
    expect(createArg.name).toBe('trimmed name');
    expect(createArg.content).toBe('trimmed content');
    expect(createArg.documentType).toBe(PromptDocumentType.LECTURE);
    expect(createArg.isDefault).toBe(false);
    expect(result).toEqual(created);
  });

  it('ensureExists throws when prompt does not exist', async () => {
    promptRepository.findOne.mockResolvedValue(null);

    await expect(service.ensureExists('missing')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('update throws for default prompt', async () => {
    promptRepository.findOne.mockResolvedValue(
      buildPrompt({
        id: 'prompt_default_meeting',
        isDefault: true,
      }),
    );

    await expect(
      service.update('prompt_default_meeting', { name: 'new name' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update mutates user prompt fields', async () => {
    const existing = buildPrompt();
    const saved = buildPrompt({
      name: 'updated',
      content: 'updated content',
      documentType: PromptDocumentType.MENTORING,
    });
    promptRepository.findOne.mockResolvedValue(existing);
    promptRepository.save.mockResolvedValue(saved);

    const result = await service.update(existing.id, {
      name: '  updated  ',
      content: '  updated content  ',
      documentType: PromptDocumentType.MENTORING,
    });

    expect(promptRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: existing.id,
        name: 'updated',
        content: 'updated content',
        documentType: PromptDocumentType.MENTORING,
      }),
    );
    expect(result).toEqual(saved);
  });

  it('remove throws for default prompt', async () => {
    promptRepository.findOne.mockResolvedValue(
      buildPrompt({
        id: 'prompt_default_meeting',
        isDefault: true,
      }),
    );

    await expect(
      service.remove('prompt_default_meeting'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(promptRepository.delete).not.toHaveBeenCalled();
  });

  it('remove deletes user prompt', async () => {
    promptRepository.findOne.mockResolvedValue(
      buildPrompt({
        id: 'prompt_user_abc',
        isDefault: false,
      }),
    );
    promptRepository.delete.mockResolvedValue({
      affected: 1,
      raw: [],
    } as never);

    await service.remove('prompt_user_abc');

    expect(promptRepository.delete).toHaveBeenCalledWith({
      id: 'prompt_user_abc',
    });
  });

  it('findById throws NotFoundException when missing', async () => {
    promptRepository.findOne.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
