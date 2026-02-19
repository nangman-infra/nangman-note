export interface MeetingResult {
  id: string;
  meetingId: string;
  promptId: string;
  content: string; // Markdown
  metadata: {
    title?: string;
    generatedAt: string;
    totalDuration: number;
    transcriptWordCount: number;
    noteLength: number;
  };
  createdAt: string;
  updatedAt: string;
}
