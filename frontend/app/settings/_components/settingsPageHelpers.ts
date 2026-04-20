import {
  BookOpenText,
  GraduationCap,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { PromptDocumentType } from '@/domains/prompt/types/prompt.types';

export const DOCUMENT_TYPE_TILE: Record<
  PromptDocumentType,
  { icon: LucideIcon; tone: string }
> = {
  meeting: { icon: Users, tone: 'bg-indigo-50 text-indigo-600' },
  lecture: { icon: BookOpenText, tone: 'bg-amber-50 text-amber-700' },
  mentoring: { icon: GraduationCap, tone: 'bg-cyan-50 text-cyan-700' },
};

export function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export const SETTINGS_FALLBACK_TILE = {
  icon: Sparkles,
  tone: 'bg-indigo-50 text-indigo-600',
};
