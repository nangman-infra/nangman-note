export type ResultTab = 'result' | 'transcript' | 'note';

export interface ResultPromptOption {
  id: string;
  name: string;
  label: string;
  documentType: 'meeting' | 'lecture' | 'mentoring';
  isDefault?: boolean;
}
