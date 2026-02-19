'use client';

import { memo } from 'react';
import type { Meeting } from '../types/meeting.types';
import { formatDate, formatDuration } from '@/lib/utils/date';

interface MeetingCardProps {
  meeting: Meeting;
  onClick?: () => void;
  isActive?: boolean;
}

export const MeetingCard = memo(({ meeting, onClick, isActive }: MeetingCardProps) => {
  const duration = meeting.endedAt 
    ? (new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 1000
    : 0;

  return (
    <div
      onClick={onClick}
      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
      }`}
    >
      <h3 className="font-medium text-sm mb-1 line-clamp-1">
        {meeting.title || '제목 없음'}
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        {formatDate(meeting.startedAt)}
      </p>
      {duration > 0 && (
        <p className="text-xs text-gray-400">
          {formatDuration(duration)}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded ${
          meeting.status === 'completed' ? 'bg-green-100 text-green-700' :
          meeting.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {meeting.status === 'completed' ? '완료' :
           meeting.status === 'processing' ? '처리 중' : '진행 중'}
        </span>
      </div>
    </div>
  );
});

MeetingCard.displayName = 'MeetingCard';
