'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, Loader2 } from 'lucide-react';

interface ResultExportMenuProps {
  isExporting: 'pdf' | 'docx' | null;
  onExportPDF: () => void;
  onExportDOCX: () => void;
}

export function ResultExportMenu({
  isExporting,
  onExportPDF,
  onExportDOCX,
}: ResultExportMenuProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  return (
    <div ref={exportMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setShowExportMenu((value) => !value)}
        disabled={isExporting !== null}
        className="btn-primary inline-flex"
        aria-haspopup="menu"
        aria-expanded={showExportMenu}
      >
        {isExporting !== null ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export
        <ChevronDown className="h-4 w-4" />
      </button>
      {showExportMenu && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-lg bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setShowExportMenu(false);
              onExportPDF();
            }}
            disabled={isExporting !== null}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF 내보내기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setShowExportMenu(false);
              onExportDOCX();
            }}
            disabled={isExporting !== null}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === 'docx' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            DOCX 내보내기
          </button>
        </div>
      )}
    </div>
  );
}
