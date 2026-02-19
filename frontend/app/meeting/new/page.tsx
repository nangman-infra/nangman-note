'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMeeting } from '@/domains/meeting/hooks/useMeeting';
import { PromptSelector } from '@/domains/prompt/components/PromptSelector';
import { usePromptStore } from '@/domains/prompt/stores/promptStore';

export default function NewMeetingPage() {
  const router = useRouter();
  const { startMeeting, isLoading } = useMeeting();
  const { selectedPromptId } = usePromptStore();
  const [title, setTitle] = useState('');

  const handleStart = async () => {
    try {
      await startMeeting({
        title: title.trim() || undefined,
        promptId: selectedPromptId,
      });
      
      // 회의 진행 화면으로 이동 (추후 구현)
      router.push('/meeting/in-progress');
    } catch (error) {
      console.error('Failed to start meeting:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">TransNote</h1>
          <p className="text-sm text-gray-600">실시간 전사 + AI 회의록</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              회의 제목 (선택)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 1분기 마케팅 전략 회의"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <PromptSelector />

          <button
            onClick={handleStart}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-lg">🎤</span>
            {isLoading ? '시작 중...' : '회의 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}
