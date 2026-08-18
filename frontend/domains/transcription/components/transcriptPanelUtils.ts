const SECONDS_PER_MINUTE = 60;

export function formatSegmentTime(seconds: number): string {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % SECONDS_PER_MINUTE);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** 화자 라벨별 뱃지 색상 팔레트 (다크 패널용) */
const SPEAKER_BADGE_CLASSES = [
  'bg-indigo-500/20 text-indigo-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-rose-500/20 text-rose-300',
  'bg-amber-500/20 text-amber-300',
  'bg-sky-500/20 text-sky-300',
  'bg-fuchsia-500/20 text-fuchsia-300',
] as const;

/** 'spk_0' → '화자 1' 형태의 표시 이름 */
export function getSpeakerDisplayName(speakerLabel: string): string {
  const match = /^spk[_-]?(\d+)$/i.exec(speakerLabel.trim());
  if (match) {
    return `화자 ${Number(match[1]) + 1}`;
  }
  return speakerLabel;
}

/** 화자 라벨에 대응하는 안정적인 뱃지 색상 클래스 */
export function getSpeakerBadgeClass(speakerLabel: string): string {
  const match = /(\d+)/.exec(speakerLabel);
  const index = match ? Number(match[1]) : hashLabel(speakerLabel);
  return SPEAKER_BADGE_CLASSES[index % SPEAKER_BADGE_CLASSES.length];
}

function hashLabel(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
