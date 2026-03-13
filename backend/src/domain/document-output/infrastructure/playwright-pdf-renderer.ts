import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright-core';
import type { AppEnv } from '../../../shared/config/env.validation';
import {
  type PdfRenderInput,
  type PdfRendererPort,
} from '../application/ports/pdf-renderer.port';

@Injectable()
export class PlaywrightPdfRenderer implements PdfRendererPort {
  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async render(input: PdfRenderInput): Promise<Buffer> {
    const executablePath = this.resolveExecutablePath();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
      ],
    });

    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 1800 },
        locale: 'ko-KR',
      });

      await page.route('**/*', (route) => {
        const url = route.request().url();

        if (
          url === 'about:blank' ||
          url.startsWith('data:') ||
          url.startsWith('blob:')
        ) {
          return route.continue();
        }

        return route.abort();
      });

      await page.emulateMedia({ media: 'print' });
      await page.setContent(input.html, { waitUntil: 'domcontentloaded' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private resolveExecutablePath(): string | undefined {
    const configuredPath = this.configService.get(
      'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH',
      {
        infer: true,
      },
    );

    const candidates = [
      configuredPath,
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    const fromPath = this.resolveFromPath([
      'chromium',
      'chromium-browser',
      'google-chrome-stable',
      'google-chrome',
    ]);
    if (fromPath) {
      return fromPath;
    }

    // undefined → playwright-core가 자체 번들 Chromium을 자동 탐색
    return undefined;
  }

  private resolveFromPath(commands: string[]): string | null {
    for (const command of commands) {
      const result = spawnSync('which', [command], {
        encoding: 'utf-8',
      });
      if (result.status === 0) {
        const found = result.stdout.trim();
        if (found.length > 0 && existsSync(found)) {
          return found;
        }
      }
    }

    return null;
  }
}
