'use client';

import { useState } from 'react';
import { usePrompt } from '../hooks/usePrompt';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';

interface PromptSelectorProps {
  onChange?: (promptId: string) => void;
}

export function PromptSelector({ onChange }: PromptSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const { prompts, selectedPromptId, setSelectedPrompt } = usePrompt();

  const handleChange = (promptId: string) => {
    setSelectedPrompt(promptId);
    onChange?.(promptId);
  };

  const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors"
      >
        <Settings className="w-4 h-4" />
        {expanded ? '고급 설정 숨기기' : '고급 설정'}
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mt-3 p-4 border rounded-lg bg-gray-50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="block text-sm font-medium text-gray-700">
            프롬프트 선택
          </label>
          
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <label
                key={prompt.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="prompt"
                  value={prompt.id}
                  checked={selectedPromptId === prompt.id}
                  onChange={() => handleChange(prompt.id)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{prompt.name}</span>
                {prompt.isDefault && (
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                    기본
                  </span>
                )}
              </label>
            ))}
          </div>

          <button
            className="w-full mt-2 text-sm text-blue-600 hover:text-blue-700 py-2 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
          >
            + 새 프롬프트 만들기
          </button>
        </div>
      )}
    </div>
  );
}
