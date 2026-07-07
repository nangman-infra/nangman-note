import { useEffect, useState } from 'react';
import {
  resultTabDataApi,
  type ResultTabTranscriptSegment,
} from '../api/resultTabDataApi';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return '데이터를 불러오지 못했습니다.';
}

export function useResultTabData({
  meetingId,
  resultId,
  resultUpdatedAt,
  isPending,
}: {
  meetingId: string;
  resultId?: string;
  resultUpdatedAt?: string;
  isPending: boolean;
}) {
  const [transcripts, setTranscripts] = useState<ResultTabTranscriptSegment[]>(
    [],
  );
  const [noteContent, setNoteContent] = useState<string>('');
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [tabDataMeetingId, setTabDataMeetingId] = useState('');

  useEffect(() => {
    if (!meetingId) return;

    let disposed = false;

    const loadTabData = async () => {
      const [segmentsResult, noteResult] = await Promise.allSettled([
        resultTabDataApi.listTranscripts(meetingId),
        resultTabDataApi.getNoteContent(meetingId),
      ]);
      if (disposed) return;

      if (segmentsResult.status === 'fulfilled') {
        setTranscripts(segmentsResult.value);
        setTranscriptError(null);
      } else {
        setTranscripts([]);
        setTranscriptError(toErrorMessage(segmentsResult.reason));
      }

      if (noteResult.status === 'fulfilled') {
        setNoteContent(noteResult.value ?? '');
        setNoteError(null);
      } else {
        setNoteContent('');
        setNoteError(toErrorMessage(noteResult.reason));
      }

      setTabDataMeetingId(meetingId);
    };

    void loadTabData();
    return () => {
      disposed = true;
    };
  }, [meetingId, resultId, resultUpdatedAt, isPending]);

  const isCurrentTabData = tabDataMeetingId === meetingId;

  return {
    visibleTranscripts: isCurrentTabData ? transcripts : [],
    visibleNoteContent: isCurrentTabData ? noteContent : '',
    visibleTranscriptError: isCurrentTabData ? transcriptError : null,
    visibleNoteError: isCurrentTabData ? noteError : null,
  };
}
