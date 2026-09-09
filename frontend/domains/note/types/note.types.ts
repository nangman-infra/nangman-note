export interface Note {
  id: string;
  meetingId: string;
  content: string; // Markdown
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export const NOTE_MAX_LENGTH = 100_000;
