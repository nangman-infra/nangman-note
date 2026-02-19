'use client';

import { useState } from 'react';
import { useResult } from '../hooks/useResult';
import ReactMarkdown from 'react-markdown';
import { Download, Copy, RefreshCw, Edit } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils/markdown';

interface ResultViewerProps {
  meetingId: string;
}

export function ResultViewer({ meetingId }: ResultViewerProps) {
  const { result, isLoading, isRegenerating, updateResult, regenerateResult, exportPDF } = useResult(meetingId);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">회의록을 불러오는 중...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">회의록이 없습니다</p>
      </div>
    );
  }

  const handleEdit = () => {
    setEditContent(result.content);
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateResult(editContent);
    setIsEditing(false);
  };

  const handleCopy = async () => {
    await copyToClipboard(result.content);
    alert('클립보드에 복사되었습니다');
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">{result.metadata?.title || '회의록'}</h2>
          <p className="text-sm text-gray-500">
            생성: {new Date(result.createdAt).toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4" />
                편집
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <Copy className="w-4 h-4" />
                복사
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </>
          )}
        </div>
      </div>

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto p-6">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full p-4 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{result.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* 재생성 */}
      {!isEditing && (
        <div className="px-6 py-4 border-t bg-gray-50">
          <button
            onClick={() => {
              const newPromptId = prompt('새 프롬프트 ID를 입력하세요:');
              if (newPromptId) {
                regenerateResult(newPromptId);
              }
            }}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-white disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? '재생성 중...' : '프롬프트 변경 후 재생성'}
          </button>
        </div>
      )}
    </div>
  );
}
