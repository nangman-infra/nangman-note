declare module '@toast-ui/editor' {
  export interface EditorOptions {
    el: HTMLElement;
    initialValue?: string;
    initialEditType?: 'wysiwyg' | 'markdown';
    previewStyle?: 'vertical' | 'tab';
    height?: string;
    usageStatistics?: boolean;
    hideModeSwitch?: boolean;
    placeholder?: string;
    toolbarItems?: Array<
      | string
      | string[]
      | Array<string | undefined>
      | [string, string, string?, string?]
    >;
  }

  export class Editor {
    constructor(options: EditorOptions);
    getMarkdown(): string;
    setMarkdown(markdown: string, cursorToEnd?: boolean): void;
    setHeight(height: string): void;
    on(eventName: string, handler: () => void): void;
    off(eventName: string, handler: () => void): void;
    destroy(): void;
  }
}
