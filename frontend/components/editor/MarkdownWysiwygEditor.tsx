'use client';

import { useEffect, useRef } from 'react';

interface MarkdownWysiwygEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  height?: string;
}

export function MarkdownWysiwygEditor({
  value,
  onChange,
  placeholder,
  height = '100%',
}: MarkdownWysiwygEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<{
    getMarkdown: () => string;
    setMarkdown: (markdown: string, cursorToEnd?: boolean) => void;
    on: (eventName: string, handler: () => void) => void;
    off: (eventName: string, handler: () => void) => void;
    setHeight: (heightValue: string) => void;
    destroy: () => void;
  } | null>(null);
  const isSyncingRef = useRef(false);
  const latestValueRef = useRef(value);
  const latestOnChangeRef = useRef(onChange);

  latestValueRef.current = value;
  latestOnChangeRef.current = onChange;

  useEffect(() => {
    let isUnmounted = false;
    const hostElement = hostRef.current;
    if (!hostElement) {
      return;
    }

    const mountEditor = async () => {
      const { Editor } = await import('@toast-ui/editor');
      if (isUnmounted || hostRef.current !== hostElement) {
        return;
      }

      const instance = new Editor({
        el: hostElement,
        initialValue: latestValueRef.current || '',
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        height,
        usageStatistics: false,
        hideModeSwitch: true,
        placeholder,
        toolbarItems: [
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task'],
          ['table', 'link'],
          ['code', 'codeblock'],
        ],
      });

      const handleChange = () => {
        if (isSyncingRef.current) {
          return;
        }

        const next = instance.getMarkdown();
        if (next !== latestValueRef.current) {
          latestOnChangeRef.current(next);
        }
      };

      instance.on('change', handleChange);
      editorRef.current = instance;

      if (instance.getMarkdown() !== latestValueRef.current) {
        isSyncingRef.current = true;
        instance.setMarkdown(latestValueRef.current || '', false);
        queueMicrotask(() => {
          isSyncingRef.current = false;
        });
      }

      return () => {
        instance.off('change', handleChange);
      };
    };

    let disposeEditorEvents: (() => void) | undefined;
    void mountEditor().then((dispose) => {
      disposeEditorEvents = dispose;
    });

    return () => {
      isUnmounted = true;
      disposeEditorEvents?.();
      editorRef.current?.destroy();
      editorRef.current = null;
      hostElement.innerHTML = '';
    };
  }, [height, placeholder]);

  useEffect(() => {
    const instance = editorRef.current;
    if (!instance) {
      return;
    }

    const current = instance.getMarkdown();
    if (current === value) {
      return;
    }

    isSyncingRef.current = true;
    instance.setMarkdown(value || '', false);
    queueMicrotask(() => {
      isSyncingRef.current = false;
    });
  }, [value]);

  return (
    <div className="markdown-wysiwyg h-full min-h-0">
      <div ref={hostRef} className="h-full min-h-0" />
    </div>
  );
}
