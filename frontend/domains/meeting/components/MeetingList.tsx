'use client';

import { useEffect, useState } from 'react';
import { useMeetings } from '../hooks/useMeeting';
import { MeetingCard } from './MeetingCard';
import { Search } from 'lucide-react';

interface MeetingListProps {
  onSelectMeeting?: (meetingId: string) => void;
  selectedMeetingId?: string;
}

export function MeetingList({ onSelectMeeting, selectedMeetingId }: MeetingListProps) {
  const { meetings, isLoading, fetchMeetings, searchMeetings } = useMeetings();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchMeetings(searchQuery);
    } else {
      fetchMeetings();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="회의 검색..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-sm text-gray-500">
            로딩 중...
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            회의가 없습니다
          </div>
        ) : (
          meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onClick={() => onSelectMeeting?.(meeting.id)}
              isActive={meeting.id === selectedMeetingId}
            />
          ))
        )}
      </div>
    </div>
  );
}
