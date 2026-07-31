import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { DocumentOutputController } from './document-output.controller';
import { DocumentOutputService } from '../application/document-output.service';

describe('DocumentOutputController', () => {
  let controller: DocumentOutputController;
  let documentOutputService: jest.Mocked<
    Pick<DocumentOutputService, 'exportResult'>
  >;
  let response: Pick<Response, 'setHeader'>;

  beforeEach(() => {
    documentOutputService = {
      exportResult: jest.fn(),
    };
    response = {
      setHeader: jest.fn(),
    };

    controller = new DocumentOutputController(
      documentOutputService as unknown as DocumentOutputService,
    );
  });

  it('streams exported file with content headers', async () => {
    documentOutputService.exportResult.mockResolvedValue({
      fileName: 'meeting_meeting-1_2026-03-13.pdf',
      contentType: 'application/pdf',
      buffer: Buffer.from('pdf-bytes'),
    });

    const file = await controller.export(
      'meeting-1',
      'pdf',
      response as Response,
      { sub: 'user-1', scope: [], raw: { sub: 'user-1' } },
    );

    expect(documentOutputService.exportResult).toHaveBeenCalledWith(
      'meeting-1',
      'pdf',
      'user-1',
    );
    expect(response.setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'application/pdf',
    );
    expect(response.setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      'attachment; filename="meeting_meeting-1_2026-03-13.pdf"',
    );
    expect(file).toBeInstanceOf(StreamableFile);
  });
});
