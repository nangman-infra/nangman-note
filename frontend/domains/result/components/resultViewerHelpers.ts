const SECONDS_PER_MINUTE = 60;

export const RESULT_SPEAKER_PALETTE = [
  'bg-indigo-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-rose-500',
];

export function formatSegmentTime(seconds: number): string {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % SECONDS_PER_MINUTE);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getSpeakerInitial(label: string): string {
  const match = label.match(/^spk[_-]?(\d+)$/i);
  if (match) {
    const index = Number.parseInt(match[1] ?? '0', 10);
    return `S${index + 1}`;
  }
  return label.slice(0, 2).toUpperCase();
}
