import { Repository } from 'typeorm';
import { PromptService } from '../../prompt/application/prompt.service';
import { MeetingTranscriptionMode } from '../../meeting/domain/meeting-transcription-mode.enum';
import { UserSettingsEntity } from '../domain/user-settings.entity';
import { UserSettingsService } from './user-settings.service';

describe('UserSettingsService', () => {
  let service: UserSettingsService;
  let userSettingsRepository: jest.Mocked<
    Pick<Repository<UserSettingsEntity>, 'findOne' | 'create' | 'save'>
  >;
  let promptService: jest.Mocked<Pick<PromptService, 'ensureExists'>>;

  beforeEach(() => {
    userSettingsRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    promptService = {
      ensureExists: jest.fn(),
    };

    service = new UserSettingsService(
      userSettingsRepository as unknown as Repository<UserSettingsEntity>,
      promptService as unknown as PromptService,
    );
  });

  it('returns defaults when a user has no stored settings yet', async () => {
    userSettingsRepository.findOne.mockResolvedValue(null);

    await expect(service.get('user-1')).resolves.toEqual({
      defaultPromptId: 'prompt_default_meeting',
      defaultTranscriptionMode: MeetingTranscriptionMode.REALTIME,
      defaultLanguageCode: '',
      defaultTranslateTargetLanguage: '',
      isConfigured: false,
    });
  });

  it('persists validated settings for the current user', async () => {
    const created = {
      ownerSub: 'user-1',
      defaultPromptId: 'prompt_user_123',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'en-US',
      defaultTranslateTargetLanguage: 'ko',
    } as UserSettingsEntity;

    userSettingsRepository.findOne.mockResolvedValue(null);
    userSettingsRepository.create.mockReturnValue(created);
    userSettingsRepository.save.mockResolvedValue(created);

    const result = await service.update(
      {
        defaultPromptId: 'prompt_user_123',
        defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
        defaultLanguageCode: ' en-US ',
        defaultTranslateTargetLanguage: ' ko ',
      },
      'user-1',
    );

    expect(promptService.ensureExists).toHaveBeenCalledWith(
      'prompt_user_123',
      'user-1',
    );
    expect(userSettingsRepository.create).toHaveBeenCalledWith({
      ownerSub: 'user-1',
      defaultPromptId: 'prompt_user_123',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'en-US',
      defaultTranslateTargetLanguage: 'ko',
    });
    expect(result).toEqual({
      defaultPromptId: 'prompt_user_123',
      defaultTranscriptionMode: MeetingTranscriptionMode.BATCH,
      defaultLanguageCode: 'en-US',
      defaultTranslateTargetLanguage: 'ko',
      isConfigured: true,
    });
  });

  it('falls back to the default prompt when an empty prompt id is provided', async () => {
    const created = {
      ownerSub: 'user-1',
      defaultPromptId: 'prompt_default_meeting',
      defaultTranscriptionMode: MeetingTranscriptionMode.REALTIME,
      defaultLanguageCode: '',
      defaultTranslateTargetLanguage: '',
    } as UserSettingsEntity;

    userSettingsRepository.findOne.mockResolvedValue(null);
    userSettingsRepository.create.mockReturnValue(created);
    userSettingsRepository.save.mockResolvedValue(created);

    await service.update({ defaultPromptId: '   ' }, 'user-1');

    expect(promptService.ensureExists).toHaveBeenCalledWith(
      'prompt_default_meeting',
      'user-1',
    );
    expect(userSettingsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPromptId: 'prompt_default_meeting',
      }),
    );
  });
});
