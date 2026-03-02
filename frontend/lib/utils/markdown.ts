export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/**
 * Toast UI Editor 등에서 저장된 노트 콘텐츠를 ReactMarkdown 에서 깨끗하게
 * 렌더링할 수 있도록 전처리합니다.
 *
 * - `<br>`, `<br/>`, `<br />` → 마크다운 줄바꿈 (두 칸 공백 + \n)
 * - `\-`, `\.` 등 불필요한 백슬래시 이스케이프 제거
 */
export function sanitizeNoteMarkdown(raw: string): string {
  return (
    raw
      // <br> 변형을 마크다운 줄바꿈으로 변환
      .replace(/<br\s*\/?>/gi, '  \n')
      // 불필요한 백슬래시 이스케이프 제거 (예: \- → -, \. → .)
      .replace(/\\([.\-!#()\[\]{}*+_`~>|])/g, '$1')
  );
}

export function downloadAsMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
