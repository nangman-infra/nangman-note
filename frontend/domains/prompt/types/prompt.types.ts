export interface Prompt {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptDto {
  name: string;
  content: string;
}
