import { PromptDocumentType } from '../../../domain/prompt/domain/prompt-document-type.enum';
import type { StructuredNoteExtraction } from './bedrock.types';

export interface NoteSourceChunk {
  noteContent: string;
  transcriptText: string;
  previousContext?: string;
  sourceLabel?: string;
}

/** Lossless, line-aware splitting, including oversized individual utterances. */
export function splitSourceText(
  text: string,
  maxChars: number,
  preferTopicBoundaries = false,
): string[] {
  if (!Number.isInteger(maxChars) || maxChars < 2) {
    throw new Error('Source chunk size must be an integer of at least 2');
  }
  const chunks: string[] = [];
  for (let start = 0; start < text.length; ) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const newline = text.lastIndexOf('\n', end - 1);
      if (newline >= start + maxChars / 2) end = newline + 1;
      if (preferTopicBoundaries) {
        // Explicit transitions are stronger boundaries than an arbitrary turn.
        // Never require these markers: ordinary and oversized turns still split.
        const window = text.slice(start, start + maxChars);
        const transitions = [
          ...window.matchAll(
            /\n(?=\[[^\]\n]+\]\s*(?:\[화자:[^\]\n]+\]\s*)?(?:이제\s|다음(?:으로|은|\s안건|\s주제)|그다음|다른\s(?:안건|주제)))/g,
          ),
        ];
        const transition = transitions.at(-1)?.index;
        if (transition !== undefined && transition >= maxChars / 2) {
          end = start + transition + 1;
        }
      }
      // Keep UTF-16 surrogate pairs together on a forced split.
      const last = text.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

function timeLabel(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function splitNoteSources(
  source: NoteSourceChunk,
  maxChars: number,
): NoteSourceChunk[] {
  if (source.noteContent.length + source.transcriptText.length <= maxChars) {
    return [source];
  }
  const chunks: NoteSourceChunk[] = [];
  // Small user notes accompany the first transcript chunk; large notes receive
  // their own extraction budget rather than being repeated in every request.
  const inlineNote = source.noteContent.length <= maxChars / 4;
  if (!inlineNote) {
    splitSourceText(source.noteContent, maxChars).forEach((text, index) => {
      chunks.push({
        noteContent: text,
        transcriptText: '',
        previousContext:
          index > 0
            ? chunks[index - 1].noteContent.slice(-1_000)
            : source.previousContext,
        sourceLabel: `노트 구간 ${index + 1}`,
      });
    });
  }
  const transcriptChunks = splitSourceText(
    source.transcriptText,
    maxChars - (inlineNote ? source.noteContent.length : 0),
    true,
  );
  transcriptChunks.forEach((text, index) => {
    const ranges = [
      ...text.matchAll(/(?:^|\n)\[(\d+(?:\.\d+)?)s ~ (\d+(?:\.\d+)?)s\]/g),
    ];
    const first = ranges[0];
    const last = ranges.at(-1);
    const range =
      first && last
        ? ` · ${timeLabel(Number(first[1]))}–${timeLabel(Number(last[2]))}`
        : '';
    chunks.push({
      noteContent: inlineNote && index === 0 ? source.noteContent : '',
      transcriptText: text,
      previousContext:
        index > 0
          ? transcriptChunks[index - 1].slice(-1_000)
          : source.previousContext,
      sourceLabel: `전사 구간 ${index + 1}${range}`,
    });
  });
  return chunks;
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

/** Merge details without a second lossy LLM summarization or a top-N cut-off. */
export function mergeExtractions(
  parts: StructuredNoteExtraction[],
): StructuredNoteExtraction {
  const first = parts[0];
  if (!first) throw new Error('No extraction parts');
  if (parts.some((part) => part.documentType !== first.documentType)) {
    throw new Error('Inconsistent extraction document types');
  }
  const shared = {
    summary: unique(parts.map((part) => part.summary)).join('\n\n'),
    suggestedTitle: parts.find((part) => part.suggestedTitle)?.suggestedTitle,
    keywords: unique(parts.flatMap((part) => part.keywords)),
    uncertainties: unique(parts.flatMap((part) => part.uncertainties)),
  };
  if (first.documentType === PromptDocumentType.MEETING) {
    const meetings = parts.filter(
      (part) => part.documentType === PromptDocumentType.MEETING,
    );
    return {
      ...first,
      ...shared,
      participants: unique(meetings.flatMap((part) => part.participants)),
      agendaItems: meetings.flatMap((part) => part.agendaItems),
      overallDecisions: unique(
        meetings.flatMap((part) => part.overallDecisions),
      ),
      followUps: unique(meetings.flatMap((part) => part.followUps)),
    };
  }
  if (first.documentType === PromptDocumentType.LECTURE) {
    const lectures = parts.filter(
      (part) => part.documentType === PromptDocumentType.LECTURE,
    );
    return {
      ...first,
      ...shared,
      concepts: lectures.flatMap((part) => part.concepts),
      practiceItems: unique(lectures.flatMap((part) => part.practiceItems)),
      keyTakeaways: unique(lectures.flatMap((part) => part.keyTakeaways)),
    };
  }
  const mentoring = parts.filter(
    (part) => part.documentType === PromptDocumentType.MENTORING,
  );
  return {
    ...first,
    ...shared,
    topics: mentoring.flatMap((part) => part.topics),
    keyTakeaways: unique(mentoring.flatMap((part) => part.keyTakeaways)),
  };
}

export function labelExtraction(
  part: StructuredNoteExtraction,
  sourceLabel?: string,
): StructuredNoteExtraction {
  if (!sourceLabel) return part;
  if ('agendaItems' in part)
    part.agendaItems.forEach((item) => {
      item.sourceLabel = sourceLabel;
    });
  if ('concepts' in part)
    part.concepts.forEach((item) => {
      item.sourceLabel = sourceLabel;
    });
  if ('topics' in part)
    part.topics.forEach((item) => {
      item.sourceLabel = sourceLabel;
    });
  return part;
}

/** A low-detail signal triggers a smaller source window, never a fact quota. */
export function hasVeryLowDetail(
  part: StructuredNoteExtraction,
  sourceChars: number,
): boolean {
  if (sourceChars < 6_000) return false;
  const primary: object[] =
    'agendaItems' in part
      ? part.agendaItems
      : 'concepts' in part
        ? part.concepts
        : part.topics;
  const details = primary.map((item) =>
    Object.fromEntries(
      Object.entries(item).filter(
        ([key]) => !['title', 'name', 'sourceLabel'].includes(key),
      ),
    ),
  );
  return JSON.stringify(details).length < sourceChars * 0.04;
}
