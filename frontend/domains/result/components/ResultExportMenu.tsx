'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Download, FileText, Loader2 } from 'lucide-react';

interface ResultExportMenuProps {
  isExporting: 'pdf' | 'docx' | 'md' | null;
  onExportPDF: () => void;
  onExportDOCX: () => void;
  onExportMD: () => void;
}

export function ResultExportMenu({
  isExporting,
  onExportPDF,
  onExportDOCX,
  onExportMD,
}: ResultExportMenuProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  useEffect(() => {
    if (showExportMenu) itemRefs.current[0]?.focus();
  }, [showExportMenu]);

  const closeAndRestoreFocus = () => {
    triggerRef.current?.focus();
    setShowExportMenu(false);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isExporting !== null) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setShowExportMenu(true);
    window.requestAnimationFrame(() => {
      const index = event.key === 'ArrowUp' ? itemRefs.current.length - 1 : 0;
      itemRefs.current[index]?.focus();
    });
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % itemRefs.current.length;
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + itemRefs.current.length) % itemRefs.current.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = itemRefs.current.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      itemRefs.current[nextIndex]?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
    } else if (event.key === 'Tab') {
      setShowExportMenu(false);
    }
  };

  return (
    <div ref={exportMenuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (isExporting === null) setShowExportMenu((value) => !value);
        }}
        aria-disabled={isExporting !== null}
        className="btn-primary inline-flex"
        aria-haspopup="menu"
        aria-expanded={showExportMenu}
        aria-controls="result-export-menu"
        aria-busy={isExporting !== null}
        onKeyDown={handleTriggerKeyDown}
      >
        {isExporting !== null ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        내보내기
        <ChevronDown className="h-4 w-4" />
      </button>
      {showExportMenu && (
        <div
          id="result-export-menu"
          role="menu"
          aria-label="내보내기 형식"
          onKeyDown={handleMenuKeyDown}
          className="surface-card absolute left-0 top-full z-20 mt-1 min-w-[180px] py-1 !shadow-[var(--elevation-md)]"
        >
          <button
            ref={(element) => { itemRefs.current[0] = element; }}
            type="button"
            role="menuitem"
            onClick={() => {
              closeAndRestoreFocus();
              onExportPDF();
            }}
            disabled={isExporting !== null}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--ink-subtle)] hover:bg-[var(--surface-container-low)] hover:text-[var(--ink-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF 내보내기
          </button>
          <button
            ref={(element) => { itemRefs.current[1] = element; }}
            type="button"
            role="menuitem"
            onClick={() => {
              closeAndRestoreFocus();
              onExportDOCX();
            }}
            disabled={isExporting !== null}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--ink-subtle)] hover:bg-[var(--surface-container-low)] hover:text-[var(--ink-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === 'docx' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            DOCX 내보내기
          </button>
          <button
            ref={(element) => { itemRefs.current[2] = element; }}
            type="button"
            role="menuitem"
            onClick={() => {
              closeAndRestoreFocus();
              onExportMD();
            }}
            disabled={isExporting !== null}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--ink-subtle)] hover:bg-[var(--surface-container-low)] hover:text-[var(--ink-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === 'md' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Markdown 내보내기
          </button>
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {isExporting ? `${isExporting.toUpperCase()} 파일을 내보내는 중입니다.` : ''}
      </span>
    </div>
  );
}
