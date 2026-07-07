import type { FinalSegment } from '../stores/transcriptionStore';

const SECONDS_PER_MINUTE = 60;

export function formatSegmentTime(seconds: number): string {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % SECONDS_PER_MINUTE);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function isKeyPointSegment(segment: FinalSegment): boolean {
  return (segment as unknown as { isKeyPoint?: boolean }).isKeyPoint === true;
}
