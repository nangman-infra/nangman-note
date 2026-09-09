import { PromptDocumentType } from '../../../domain/prompt/domain/prompt-document-type.enum';

export type StructuredActionItemPriority = 'High' | 'Medium' | 'Low';

export interface StructuredActionItem {
  task: string;
  owner: string;
  deadline: string;
  priority: StructuredActionItemPriority;
}

export interface StructuredMeetingAgendaItem {
  title: string;
  /** Source chunk label computed by the server, not an invented model citation. */
  sourceLabel?: string;
  context?: string;
  discussionPoints: string[];
  decisions: string[];
  actionItems: StructuredActionItem[];
  unresolved: string[];
}

export interface StructuredMeetingExtraction {
  documentType: PromptDocumentType.MEETING;
  suggestedTitle?: string;
  summary: string;
  participants: string[];
  agendaItems: StructuredMeetingAgendaItem[];
  overallDecisions: string[];
  followUps: string[];
  keywords: string[];
  uncertainties: string[];
}

export interface StructuredLectureConcept {
  name: string;
  sourceLabel?: string;
  context?: string;
  definition: string;
  example: string;
  keyPoints: string[];
}

export interface StructuredLectureExtraction {
  documentType: PromptDocumentType.LECTURE;
  suggestedTitle?: string;
  summary: string;
  concepts: StructuredLectureConcept[];
  practiceItems: string[];
  keyTakeaways: string[];
  keywords: string[];
  uncertainties: string[];
}

export interface StructuredMentoringTopic {
  title: string;
  sourceLabel?: string;
  context?: string;
  keyPoints: string[];
  practicalTips: string[];
  followUpTasks: string[];
  researchTopics: string[];
  cautions: string[];
}

export interface StructuredMentoringExtraction {
  documentType: PromptDocumentType.MENTORING;
  suggestedTitle?: string;
  summary: string;
  topics: StructuredMentoringTopic[];
  keyTakeaways: string[];
  keywords: string[];
  uncertainties: string[];
}

export type StructuredNoteExtraction =
  | StructuredMeetingExtraction
  | StructuredLectureExtraction
  | StructuredMentoringExtraction;
