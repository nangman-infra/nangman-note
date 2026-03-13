import { BadRequestException } from '@nestjs/common';
import { ResultService } from '../../result/application/result.service';
import { ResultEntity } from '../../result/domain/result.entity';
import { DocumentOutputService } from './document-output.service';
import type { PdfRendererPort } from './ports/pdf-renderer.port';

describe('DocumentOutputService', () => {
  let service: DocumentOutputService;
  let resultService: jest.Mocked<Pick<ResultService, 'findByMeetingId'>>;
  let pdfRenderer: jest.Mocked<PdfRendererPort>;

  beforeEach(() => {
    resultService = {
      findByMeetingId: jest.fn(),
    };
    pdfRenderer = {
      render: jest.fn(),
    };

    service = new DocumentOutputService(
      resultService as unknown as ResultService,
      pdfRenderer,
    );
  });

  it('exports markdown result buffer', async () => {
    resultService.findByMeetingId.mockResolvedValue(
      buildResult({ content: '# Markdown' }),
    );

    const exported = await service.exportResult('meeting-1', 'md');

    expect(exported.fileName).toMatch(
      /^meeting_meeting-1_\d{4}-\d{2}-\d{2}\.md$/u,
    );
    expect(exported.contentType).toBe('text/markdown; charset=utf-8');
    expect(exported.buffer.toString('utf-8')).toBe('# Markdown');
  });

  it('renders PDF through the browser renderer using HTML output', async () => {
    resultService.findByMeetingId.mockResolvedValue(
      buildResult({
        content:
          '## 요약\n\n- 첫 번째 항목\n\n| 작업 | 담당 |\n| --- | --- |\n| 문서화 | 택준 |',
      }),
    );
    pdfRenderer.render.mockResolvedValue(Buffer.from('pdf-bytes'));

    const exported = await service.exportResult('meeting-1', 'pdf');

    expect(exported.contentType).toBe('application/pdf');
    expect(exported.buffer.toString('utf-8')).toBe('pdf-bytes');
    expect(pdfRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '테스트 회의',
        html: expect.stringContaining('<h2>요약</h2>'),
      }),
    );
    expect(pdfRenderer.render.mock.calls[0]?.[0].html).toContain(
      '<li>첫 번째 항목</li>',
    );
    expect(pdfRenderer.render.mock.calls[0]?.[0].html).toContain('<table>');
  });

  it('exports DOCX buffer for word documents', async () => {
    resultService.findByMeetingId.mockResolvedValue(
      buildResult({ content: '## 항목\n\n- 정리 필요' }),
    );

    const exported = await service.exportResult('meeting-1', 'docx');

    expect(exported.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(exported.fileName).toMatch(
      /^meeting_meeting-1_\d{4}-\d{2}-\d{2}\.docx$/u,
    );
    expect(exported.buffer.byteLength).toBeGreaterThan(0);
  });

  it('throws BadRequestException on unsupported export format', async () => {
    resultService.findByMeetingId.mockResolvedValue(buildResult());

    await expect(
      service.exportResult('meeting-1', 'txt'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function buildResult(overrides: Partial<ResultEntity> = {}): ResultEntity {
  return {
    id: 'result-1',
    meetingId: 'meeting-1',
    promptId: 'prompt_default_meeting',
    content: '# 결과',
    metadata: {
      title: '테스트 회의',
      generatedAt: '2026-03-13T00:00:00.000Z',
      totalDuration: 600,
      transcriptWordCount: 10,
      noteLength: 20,
    },
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    ...overrides,
  } as unknown as ResultEntity;
}
