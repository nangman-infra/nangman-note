import { apiClient } from '@/lib/api/client';
import type { Prompt, CreatePromptDto, PromptListResponse } from '../types/prompt.types';

export const promptApi = {
  // 프롬프트 목록 조회
  list: async (): Promise<Prompt[]> => {
    const response = await apiClient.get<{ data: PromptListResponse }>('/api/v1/prompts');
    // 기본 프롬프트 + 사용자 프롬프트 합치기
    return [...response.data.data.default, ...response.data.data.user];
  },

  // 프롬프트 상세 조회
  get: async (id: string): Promise<Prompt> => {
    const response = await apiClient.get<{ data: Prompt }>(`/api/v1/prompts/${id}`);
    return response.data.data;
  },

  // 사용자 프롬프트 생성
  create: async (dto: CreatePromptDto): Promise<Prompt> => {
    const response = await apiClient.post<{ data: Prompt }>('/api/v1/prompts', dto);
    return response.data.data;
  },

  // 사용자 프롬프트 수정
  update: async (id: string, dto: Partial<CreatePromptDto>): Promise<Prompt> => {
    const response = await apiClient.put<{ data: Prompt }>(`/api/v1/prompts/${id}`, dto);
    return response.data.data;
  },

  // 사용자 프롬프트 삭제
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/prompts/${id}`);
  },
};
