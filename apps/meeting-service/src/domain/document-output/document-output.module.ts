import { Module } from '@nestjs/common';
import { ResultModule } from '../result/result.module';
import { DocumentOutputService } from './application/document-output.service';
import { PDF_RENDERER } from './application/ports/pdf-renderer.port';
import { DocumentOutputController } from './infrastructure/document-output.controller';
import { PlaywrightPdfRenderer } from './infrastructure/playwright-pdf-renderer';

@Module({
  imports: [ResultModule],
  controllers: [DocumentOutputController],
  providers: [
    DocumentOutputService,
    PlaywrightPdfRenderer,
    {
      provide: PDF_RENDERER,
      useExisting: PlaywrightPdfRenderer,
    },
  ],
  exports: [DocumentOutputService],
})
export class DocumentOutputModule {}
