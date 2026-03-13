import { apiClient } from '@/lib/api/client';
import type {
  UpdateUserSettingsDto,
  UserSettings,
} from '../types/settings.types';

export const settingsApi = {
  get: async (): Promise<UserSettings> => {
    const response = await apiClient.get<{ data: UserSettings }>(
      '/api/v1/user-settings',
    );
    return response.data.data;
  },

  update: async (dto: UpdateUserSettingsDto): Promise<UserSettings> => {
    const response = await apiClient.patch<{ data: UserSettings }>(
      '/api/v1/user-settings',
      dto,
    );
    return response.data.data;
  },
};
