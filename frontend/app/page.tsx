'use client';

import { useState } from 'react';
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { MeetingList } from '@/domains/meeting/components/MeetingList';
import { ResultViewer } from '@/domains/result/components/ResultViewer';

export default function HomePage() {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  return (
    <ThreeColumnLayout
      sidebar={<Sidebar />}
      list={
        <MeetingList
          onSelectMeeting={setSelectedMeetingId}
          selectedMeetingId={selectedMeetingId || undefined}
        />
      }
      viewer={
        selectedMeetingId ? (
          <ResultViewer meetingId={selectedMeetingId} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            회의를 선택하세요
          </div>
        )
      }
    />
  );
}
