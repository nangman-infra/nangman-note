import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import MarkdownIt from 'markdown-it';
import { ResultService } from '../../result/application/result.service';
import type { ExportFormat } from '../domain/export-format.type';
import type { ExportedDocument } from '../domain/exported-document.interface';
import {
  PDF_RENDERER,
  type PdfRendererPort,
} from './ports/pdf-renderer.port';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

@Injectable()
export class DocumentOutputService {
  private readonly logger = new StructuredLogger(DocumentOutputService.name);
  private readonly markdown = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: false,
  });

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
    const result = await this.resultService.findByMeetingId(meetingId, ownerSub);
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

  private async renderDocxBuffer(
    title: string,
    content: string,
  ): Promise<Buffer> {
    const bodyLines = this.convertMarkdownToPlainLines(content);
    const children: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 32,
          }),
        ],
      }),
      new Paragraph({ text: '' }),
    ];

    for (const line of bodyLines) {
      const cleaned = line.trim();
      if (cleaned.length === 0) {
        children.push(new Paragraph({ text: '' }));
        continue;
      }

      children.push(
        new Paragraph({
          children: [new TextRun({ text: cleaned, size: 22 })],
        }),
      );
    }

    const document = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    return Packer.toBuffer(document);
  }

  private convertMarkdownToPlainLines(markdown: string): string[] {
    const sourceLines = markdown.replace(/\r\n/g, '\n').split('\n');
    const lines: string[] = [];
    let inCodeBlock = false;

    for (const rawLine of sourceLines) {
      const trimmed = rawLine.trim();

      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        lines.push('');
        continue;
      }

      if (inCodeBlock) {
        lines.push(rawLine.length > 0 ? `    ${rawLine}` : '');
        continue;
      }

      if (/^([-*_])\1{2,}$/.test(trimmed)) {
        lines.push('');
        continue;
      }

      const headingMatch = rawLine.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        lines.push(this.stripMarkdownInline(headingMatch[2]).trim());
        lines.push('');
        continue;
      }

      const quoteMatch = rawLine.match(/^\s{0,3}>\s?(.*)$/);
      if (quoteMatch) {
        const quoteContent = this.stripMarkdownInline(quoteMatch[1]).trim();
        lines.push(quoteContent.length > 0 ? `인용: ${quoteContent}` : '');
        continue;
      }

      const unorderedMatch = rawLine.match(/^(\s*)[-*+]\s+(.*)$/);
      if (unorderedMatch) {
        const indent = Math.min(Math.floor(unorderedMatch[1].length / 2), 3);
        const bulletContent = this.stripMarkdownInline(
          unorderedMatch[2],
        ).trim();
        lines.push(`${'  '.repeat(indent)}• ${bulletContent}`);
        continue;
      }

      const orderedMatch = rawLine.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
      if (orderedMatch) {
        const indent = Math.min(Math.floor(orderedMatch[1].length / 2), 3);
        const numberContent = this.stripMarkdownInline(orderedMatch[3]).trim();
        lines.push(
          `${'  '.repeat(indent)}${orderedMatch[2]}. ${numberContent}`,
        );
        continue;
      }

      const tableRowMatch = rawLine.match(/^\s*\|(.+)\|\s*$/);
      if (tableRowMatch) {
        const cells = tableRowMatch[1].split('|').map((cell) => cell.trim());
        if (cells.every((cell) => /^[-:]+$/.test(cell))) {
          continue;
        }
        lines.push(cells.filter((cell) => cell.length > 0).join(' | '));
        continue;
      }

      lines.push(this.stripMarkdownInline(rawLine).trim());
    }

    return this.compressBlankLines(lines);
  }

  private stripMarkdownInline(source: string): string {
    let line = source;

    line = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, altText: string) =>
      altText?.trim().length > 0 ? `[이미지: ${altText.trim()}]` : '[이미지]',
    );
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
    line = line.replace(/`([^`]+)`/g, '$1');
    line = line.replace(/\*\*([^*]+)\*\*/g, '$1');
    line = line.replace(/__([^_]+)__/g, '$1');
    line = line.replace(/\*([^*]+)\*/g, '$1');
    line = line.replace(/_([^_]+)_/g, '$1');
    line = line.replace(/~~([^~]+)~~/g, '$1');
    line = line.replace(/\\([\\`*_{}()[\]#+\-.!>])/g, '$1');
    line = line.replace(/\s+/g, ' ');

    return line;
  }

  private compressBlankLines(lines: string[]): string[] {
    const compact: string[] = [];
    let previousWasBlank = false;

    for (const line of lines) {
      const isBlank = line.trim().length === 0;
      if (isBlank) {
        if (!previousWasBlank) {
          compact.push('');
        }
      } else {
        compact.push(line);
      }
      previousWasBlank = isBlank;
    }

    while (compact.length > 0 && compact[0] === '') {
      compact.shift();
    }
    while (compact.length > 0 && compact[compact.length - 1] === '') {
      compact.pop();
    }

    return compact;
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

