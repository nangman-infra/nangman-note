export interface PdfRenderInput {
  title: string;
  html: string;
}

export interface PdfRendererPort {
  render(input: PdfRenderInput): Promise<Buffer>;
}

export const PDF_RENDERER = Symbol('PDF_RENDERER');
