import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import * as os from 'os';
import { chromium, type Browser } from 'playwright-core';
import type { AppEnv } from '../../../shared/config/env.validation';
import { StructuredLogger } from '../../../shared/logging/structured-logger';
import {
  type PdfRenderInput,
  type PdfRendererPort,
} from '../application/ports/pdf-renderer.port';

const DEFAULT_DYNAMIC_PDF_CONCURRENCY = 2;
const MAX_DYNAMIC_PDF_CONCURRENCY = 4;
const PDF_RENDER_MEMORY_BUDGET_BYTES = 512 * 1024 * 1024;

@Injectable()
export class PlaywrightPdfRenderer implements PdfRendererPort, OnModuleDestroy {
  private readonly logger = new StructuredLogger(PlaywrightPdfRenderer.name);
  private activeRenderCount = 0;
  private readonly renderQueue: Array<() => void> = [];
  private browserPromise: Promise<Browser> | null = null;
  private browserInstance: Browser | null = null;
  private resolvedMaxConcurrentRenders: number | null = null;

  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  async render(input: PdfRenderInput): Promise<Buffer> {
    return this.withRenderSlot(async () => {
      try {
        return await this.renderOnce(input);
      } catch (error) {
        if (!this.isRetryableBrowserError(error)) {
          throw error;
        }

        this.logger.warn(
          'document_output.pdf_render.retrying_after_browser_error',
          {
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        );
        await this.resetBrowser();

        return this.renderOnce(input);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.resetBrowser();
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

  private async getBrowser(): Promise<Browser> {
    if (this.browserPromise) {
      return this.browserPromise;
    }

    const executablePath = this.resolveExecutablePath();
    const browserPromise = chromium
      .launch({
        ...(executablePath ? { executablePath } : {}),
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
        ],
      })
      .then((browser) => {
        this.browserInstance = browser;
        browser.on('disconnected', () => {
          if (this.browserInstance === browser) {
            this.browserInstance = null;
          }
          if (this.browserPromise === browserPromise) {
            this.browserPromise = null;
          }
          this.logger.warn('document_output.browser.disconnected');
        });
        return browser;
      })
      .catch((error) => {
        if (this.browserPromise === browserPromise) {
          this.browserPromise = null;
        }
        if (this.browserInstance) {
          this.browserInstance = null;
        }
        throw error;
      });

    this.browserPromise = browserPromise;
    return browserPromise;
  }

  private async renderOnce(input: PdfRenderInput): Promise<Buffer> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1800 },
      locale: 'ko-KR',
    });

    try {
      const page = await context.newPage();

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
      await context.close().catch(() => undefined);
    }
  }

  private async withRenderSlot<T>(task: () => Promise<T>): Promise<T> {
    await this.acquireRenderSlot();

    try {
      return await task();
    } finally {
      this.releaseRenderSlot();
    }
  }

  private async acquireRenderSlot(): Promise<void> {
    if (this.activeRenderCount < this.getMaxConcurrentRenders()) {
      this.activeRenderCount += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.renderQueue.push(() => {
        this.activeRenderCount += 1;
        resolve();
      });
    });
  }

  private releaseRenderSlot(): void {
    this.activeRenderCount = Math.max(0, this.activeRenderCount - 1);
    const next = this.renderQueue.shift();
    if (next) {
      next();
    }
  }

  private getMaxConcurrentRenders(): number {
    if (this.resolvedMaxConcurrentRenders !== null) {
      return this.resolvedMaxConcurrentRenders;
    }

    const configured = this.configService.get(
      'PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS',
      {
        infer: true,
      },
    );

    if (typeof configured === 'number') {
      this.resolvedMaxConcurrentRenders = configured;
      this.logger.log('document_output.pdf_concurrency.configured', {
        source: 'env',
        maxConcurrentRenders: configured,
      });
      return configured;
    }

    const computed = this.computeDynamicPdfConcurrency();
    this.resolvedMaxConcurrentRenders = computed.maxConcurrentRenders;
    this.logger.log('document_output.pdf_concurrency.configured', {
      source: 'dynamic',
      maxConcurrentRenders: computed.maxConcurrentRenders,
      availableParallelism: computed.availableParallelism,
      constrainedMemoryBytes: computed.constrainedMemoryBytes,
      availableMemoryBytes: computed.availableMemoryBytes,
      memoryBudgetBytes: computed.memoryBudgetBytes,
      cpuSlots: computed.cpuSlots,
      memorySlots: computed.memorySlots,
    });
    return computed.maxConcurrentRenders;
  }

  private computeDynamicPdfConcurrency(): {
    maxConcurrentRenders: number;
    availableParallelism: number;
    constrainedMemoryBytes: number;
    availableMemoryBytes: number;
    memoryBudgetBytes: number;
    cpuSlots: number;
    memorySlots: number;
  } {
    const availableParallelism = this.getAvailableParallelism();
    const constrainedMemoryBytes = this.getConstrainedMemoryBytes();
    const availableMemoryBytes = this.getAvailableMemoryBytes();
    const memoryBudgetBytes =
      constrainedMemoryBytes > 0
        ? constrainedMemoryBytes
        : availableMemoryBytes > 0
          ? availableMemoryBytes
          : os.totalmem();

    const cpuSlots = Math.max(
      1,
      Math.floor(Math.max(1, availableParallelism) / 2),
    );
    const memorySlots = Math.max(
      1,
      Math.floor(memoryBudgetBytes / PDF_RENDER_MEMORY_BUDGET_BYTES),
    );
    const maxConcurrentRenders = Math.min(
      MAX_DYNAMIC_PDF_CONCURRENCY,
      Math.max(1, Math.min(cpuSlots, memorySlots, MAX_DYNAMIC_PDF_CONCURRENCY)),
    );

    return {
      maxConcurrentRenders:
        Number.isFinite(maxConcurrentRenders) && maxConcurrentRenders > 0
          ? maxConcurrentRenders
          : DEFAULT_DYNAMIC_PDF_CONCURRENCY,
      availableParallelism,
      constrainedMemoryBytes,
      availableMemoryBytes,
      memoryBudgetBytes,
      cpuSlots,
      memorySlots,
    };
  }

  private getAvailableParallelism(): number {
    return typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length;
  }

  private getConstrainedMemoryBytes(): number {
    return typeof process.constrainedMemory === 'function'
      ? process.constrainedMemory()
      : 0;
  }

  private getAvailableMemoryBytes(): number {
    return typeof process.availableMemory === 'function'
      ? process.availableMemory()
      : 0;
  }

  private async resetBrowser(): Promise<void> {
    const browser = this.browserInstance;
    const browserPromise = this.browserPromise;

    this.browserInstance = null;
    this.browserPromise = null;

    if (browser) {
      await browser.close().catch(() => undefined);
      return;
    }

    if (browserPromise) {
      const resolvedBrowser = await browserPromise.catch(() => null);
      if (resolvedBrowser) {
        await resolvedBrowser.close().catch(() => undefined);
      }
    }
  }

  private isRetryableBrowserError(error: unknown): boolean {
    const message =
      error instanceof Error
        ? `${error.name} ${error.message}`
        : typeof error === 'string'
          ? error
          : '';
    const normalized = message.toLowerCase();

    return (
      normalized.includes('target page, context or browser has been closed') ||
      normalized.includes('browser has been closed') ||
      normalized.includes('browser closed') ||
      normalized.includes('browser disconnected') ||
      normalized.includes('connection closed') ||
      normalized.includes('target closed')
    );
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
