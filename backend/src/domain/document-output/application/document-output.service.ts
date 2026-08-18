/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
} from 'docx';
import MarkdownIt from 'markdown-it';
import { ResultService } from '../../result/application/result.service';
import type { ExportFormat } from '../domain/export-format.type';
import type { ExportedDocument } from '../domain/exported-document.interface';
import { PDF_RENDERER, type PdfRendererPort } from './ports/pdf-renderer.port';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

type DocxBlock = Paragraph | Table;

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
}

@Injectable()
export class DocumentOutputService {
  private readonly logger = new StructuredLogger(DocumentOutputService.name);
  private readonly markdown = this.createPdfMarkdownRenderer();

  constructor(
    private readonly resultService: ResultService,
    @Inject(PDF_RENDERER)
    private readonly pdfRenderer: PdfRendererPort,
  ) {}

  async exportResult(
    meetingId: string,
    rawFormat?: string,
    ownerSub?: string,
  ): Promise<ExportedDocument> {
    const result = await this.resultService.findByMeetingId(
      meetingId,
      ownerSub,
    );
    const format = this.resolveFormat(rawFormat);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'md') {
      return {
        fileName: `meeting_${meetingId}_${stamp}.md`,
        contentType: 'text/markdown; charset=utf-8',
        buffer: Buffer.from(result.content, 'utf-8'),
      };
    }

    const title = result.metadata.title?.trim() || 'Meeting Result';

    this.logger.log('document_output.export.started', {
      meetingId,
      format,
      ownerSub,
    });

    const buffer =
      format === 'pdf'
        ? await this.renderPdfBuffer(title, result.content)
        : await this.renderDocxBuffer(title, result.content);

    this.logger.log('document_output.export.completed', {
      meetingId,
      format,
      ownerSub,
      byteLength: buffer.byteLength,
    });

    return {
      fileName: `meeting_${meetingId}_${stamp}.${format}`,
      contentType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer,
    };
  }

  private resolveFormat(rawFormat?: string): ExportFormat {
    if (!rawFormat) {
      return 'pdf';
    }

    if (rawFormat === 'pdf' || rawFormat === 'docx' || rawFormat === 'md') {
      return rawFormat;
    }

    throw new BadRequestException(
      'Unsupported export format. Use one of: pdf, docx, md',
    );
  }

  private async renderPdfBuffer(
    title: string,
    content: string,
  ): Promise<Buffer> {
    const html = this.buildPdfHtml(title, content);
    return this.pdfRenderer.render({ title, html });
  }

  private buildPdfHtml(title: string, content: string): string {
    const bodyHtml =
      this.markdown.render(content).trim() || '<p>문서 내용이 없습니다.</p>';
    const safeTitle = this.escapeHtml(title);

    return [
      '<!doctype html>',
      '<html lang="ko">',
      '<head>',
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      `<title>${safeTitle}</title>`,
      '<style>',
      '@page { size: A4; margin: 18mm 14mm 18mm 14mm; }',
      '* { box-sizing: border-box; }',
      'html, body { margin: 0; padding: 0; }',
      'body { color: #17202a; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      'main { font-family: "Noto Sans CJK KR", "Noto Sans KR", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif; font-size: 12px; line-height: 1.7; word-break: keep-all; overflow-wrap: anywhere; }',
      'h1 { margin: 0 0 20px; font-size: 24px; line-height: 1.3; font-weight: 800; color: #0f172a; }',
      'h2, h3, h4 { margin: 24px 0 10px; line-height: 1.35; color: #0f172a; page-break-after: avoid; }',
      'h2 { font-size: 17px; font-weight: 800; }',
      'h3 { font-size: 14px; font-weight: 700; }',
      'h4 { font-size: 12px; font-weight: 700; }',
      'p, ul, ol, blockquote, pre, table { margin: 0 0 10px; }',
      'ul, ol { padding-left: 22px; }',
      'li { margin: 0 0 4px; }',
      'blockquote { margin-left: 0; padding: 10px 14px; border-left: 4px solid #cbd5e1; background: #f8fafc; color: #475569; }',
      'pre { padding: 12px 14px; border-radius: 10px; background: #f8fafc; white-space: pre-wrap; word-break: break-word; }',
      'code { font-family: "SFMono-Regular", "Menlo", "Consolas", monospace; font-size: 0.92em; }',
      'a { color: #0f766e; text-decoration: none; }',
      'hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }',
      'table { width: 100%; border-collapse: collapse; table-layout: fixed; }',
      'th, td { border: 1px solid #d7dee7; padding: 8px 10px; vertical-align: top; text-align: left; }',
      'th { background: #f8fafc; font-weight: 700; }',
      '</style>',
      '</head>',
      '<body>',
      '<main>',
      `<h1>${safeTitle}</h1>`,
      bodyHtml,
      '</main>',
      '</body>',
      '</html>',
    ].join('');
  }

  private createPdfMarkdownRenderer(): MarkdownIt {
    const markdown = new MarkdownIt({
      html: false,
      linkify: true,
      breaks: true,
      typographer: false,
    });

    // PDF export must stay self-contained to avoid server-side fetches.
    markdown.renderer.rules.image = () => '';

    return markdown;
  }

  /**
   * Markdown → 서식 보존 DOCX 변환.
   * 헤딩 레벨, 불릿/번호 리스트, 표, 인용, 코드블록, 인라인 서식
   * (굵게/기울임/취소선/코드/링크)을 실제 Word 요소로 매핑합니다.
   */
  private async renderDocxBuffer(
    title: string,
    content: string,
  ): Promise<Buffer> {
    const children: DocxBlock[] = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun({ text: title, bold: true })],
        spacing: { after: 240 },
      }),
      ...this.convertMarkdownToDocxBlocks(content),
    ];

    const document = new Document({
      numbering: {
        config: [
          {
            reference: 'md-ordered-list',
            levels: [0, 1, 2, 3].map((level) => ({
              level,
              format: LevelFormat.DECIMAL,
              text: `%${level + 1}.`,
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720 * (level + 1), hanging: 360 },
                },
              },
            })),
          },
        ],
      },
      styles: {
        default: {
          document: {
            run: { size: 22, font: 'Malgun Gothic' },
            paragraph: { spacing: { after: 120, line: 300 } },
          },
        },
      },
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    return Packer.toBuffer(document);
  }

  private convertMarkdownToDocxBlocks(markdown: string): DocxBlock[] {
    const sourceLines = markdown.replace(/\r\n/g, '\n').split('\n');
    const blocks: DocxBlock[] = [];
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let tableRows: string[][] = [];

    const flushTable = () => {
      if (tableRows.length === 0) return;
      blocks.push(this.buildDocxTable(tableRows));
      tableRows = [];
    };

    const flushCodeBlock = () => {
      for (const codeLine of codeBlockLines) {
        blocks.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeLine.length > 0 ? codeLine : ' ',
                font: 'Consolas',
                size: 18,
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: 'F1F5F9',
            },
            spacing: { after: 0 },
          }),
        );
      }
      codeBlockLines = [];
    };

    for (const rawLine of sourceLines) {
      const trimmed = rawLine.trim();

      // 코드블록 경계
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock();
        } else {
          flushTable();
        }
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) {
        codeBlockLines.push(rawLine);
        continue;
      }

      // 표 행
      const tableRowMatch = rawLine.match(/^\s*\|(.+)\|\s*$/);
      if (tableRowMatch) {
        const cells = tableRowMatch[1].split('|').map((cell) => cell.trim());
        // 구분선 행 (|---|---|)은 스킵
        if (cells.every((cell) => /^:?-{2,}:?$/.test(cell) || cell === '')) {
          continue;
        }
        tableRows.push(cells);
        continue;
      }
      flushTable();

      if (trimmed.length === 0) {
        continue;
      }

      // 수평선
      if (/^([-*_])\1{2,}$/.test(trimmed)) {
        blocks.push(
          new Paragraph({
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: 'D1D5DB',
              },
            },
            spacing: { after: 160 },
          }),
        );
        continue;
      }

      // 헤딩
      const headingMatch = rawLine.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        blocks.push(
          new Paragraph({
            heading: this.mapHeadingLevel(level),
            children: this.parseInlineRuns(headingMatch[2]),
            spacing: { before: 240, after: 120 },
          }),
        );
        continue;
      }

      // 인용
      const quoteMatch = rawLine.match(/^\s{0,3}>\s?(.*)$/);
      if (quoteMatch) {
        blocks.push(
          new Paragraph({
            children: this.parseInlineRuns(quoteMatch[1], {
              italics: true,
            }),
            indent: { left: 360 },
            border: {
              left: {
                style: BorderStyle.SINGLE,
                size: 18,
                color: 'CBD5E1',
              },
            },
          }),
        );
        continue;
      }

      // 불릿 리스트
      const unorderedMatch = rawLine.match(/^(\s*)[-*+]\s+(.*)$/);
      if (unorderedMatch) {
        const level = Math.min(Math.floor(unorderedMatch[1].length / 2), 3);
        blocks.push(
          new Paragraph({
            children: this.parseInlineRuns(unorderedMatch[2]),
            bullet: { level },
            spacing: { after: 60 },
          }),
        );
        continue;
      }

      // 번호 리스트
      const orderedMatch = rawLine.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
      if (orderedMatch) {
        const level = Math.min(Math.floor(orderedMatch[1].length / 2), 3);
        blocks.push(
          new Paragraph({
            children: this.parseInlineRuns(orderedMatch[3]),
            numbering: { reference: 'md-ordered-list', level },
            spacing: { after: 60 },
          }),
        );
        continue;
      }

      // 일반 문단
      blocks.push(
        new Paragraph({
          children: this.parseInlineRuns(rawLine.trim()),
        }),
      );
    }

    if (inCodeBlock) {
      flushCodeBlock();
    }
    flushTable();

    if (blocks.length === 0) {
      blocks.push(new Paragraph({ text: '문서 내용이 없습니다.' }));
    }

    return blocks;
  }

  private mapHeadingLevel(
    level: number,
  ): NonNullable<IParagraphOptions['heading']> {
    switch (level) {
      case 1:
        return HeadingLevel.HEADING_1;
      case 2:
        return HeadingLevel.HEADING_2;
      case 3:
        return HeadingLevel.HEADING_3;
      case 4:
        return HeadingLevel.HEADING_4;
      case 5:
        return HeadingLevel.HEADING_5;
      default:
        return HeadingLevel.HEADING_6;
    }
  }

  private buildDocxTable(rows: string[][]): Table {
    const columnCount = Math.max(...rows.map((row) => row.length));

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(
        (cells, rowIndex) =>
          new TableRow({
            tableHeader: rowIndex === 0,
            children: Array.from({ length: columnCount }, (_, columnIndex) => {
              const cellText = cells[columnIndex] ?? '';
              return new TableCell({
                shading:
                  rowIndex === 0
                    ? { type: ShadingType.CLEAR, fill: 'F8FAFC' }
                    : undefined,
                children: [
                  new Paragraph({
                    children: this.parseInlineRuns(cellText, {
                      bold: rowIndex === 0 || undefined,
                    }),
                    spacing: { after: 0 },
                  }),
                ],
              });
            }),
          }),
      ),
    });
  }

  /**
   * 인라인 마크다운(굵게/기울임/취소선/코드/링크)을 docx Run으로 변환.
   */
  private parseInlineRuns(
    source: string,
    baseStyle: InlineStyle = {},
  ): Array<TextRun | ExternalHyperlink> {
    const runs: Array<TextRun | ExternalHyperlink> = [];
    // 이미지 → 대체 텍스트
    const text = source.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, altText: string) =>
        altText?.trim().length > 0 ? `[이미지: ${altText.trim()}]` : '[이미지]',
    );

    const INLINE_PATTERN =
      /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(~~([^~]+)~~)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(\*([^*\s][^*]*)\*)|(\b_([^_\s][^_]*)_\b)/g;

    let cursor = 0;
    let match: RegExpExecArray | null;

    const pushPlain = (plain: string) => {
      if (!plain) return;
      runs.push(this.buildTextRun(plain, baseStyle));
    };

    while ((match = INLINE_PATTERN.exec(text)) !== null) {
      pushPlain(text.slice(cursor, match.index));
      cursor = match.index + match[0].length;

      if (match[2] !== undefined || match[4] !== undefined) {
        // **bold** / __bold__
        runs.push(
          this.buildTextRun(match[2] ?? match[4], { ...baseStyle, bold: true }),
        );
      } else if (match[6] !== undefined) {
        // ~~strike~~
        runs.push(this.buildTextRun(match[6], { ...baseStyle, strike: true }));
      } else if (match[8] !== undefined) {
        // `code`
        runs.push(this.buildTextRun(match[8], { ...baseStyle, code: true }));
      } else if (match[10] !== undefined && match[11] !== undefined) {
        // [text](url)
        runs.push(
          new ExternalHyperlink({
            link: match[11],
            children: [
              new TextRun({
                text: match[10],
                style: 'Hyperlink',
                bold: baseStyle.bold,
                italics: baseStyle.italics,
              }),
            ],
          }),
        );
      } else if (match[13] !== undefined || match[15] !== undefined) {
        // *italic* / _italic_
        runs.push(
          this.buildTextRun(match[13] ?? match[15], {
            ...baseStyle,
            italics: true,
          }),
        );
      }
    }

    pushPlain(text.slice(cursor));

    if (runs.length === 0) {
      runs.push(this.buildTextRun(' ', baseStyle));
    }

    return runs;
  }

  private buildTextRun(text: string, style: InlineStyle): TextRun {
    return new TextRun({
      text,
      bold: style.bold,
      italics: style.italics,
      strike: style.strike,
      font: style.code ? 'Consolas' : undefined,
      shading: style.code
        ? { type: ShadingType.CLEAR, fill: 'F1F5F9' }
        : undefined,
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
