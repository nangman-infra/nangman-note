export interface TranscriptSegment {
  id: string;
  meetingId: string;
  startTime: number; // 초
  endTime: number; // 초
  text: string;
  confidence: number; // 0-1
  createdAt: string;
}
