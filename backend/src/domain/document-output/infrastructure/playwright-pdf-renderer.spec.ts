import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-core';
import { PlaywrightPdfRenderer } from './playwright-pdf-renderer';

jest.mock('playwright-core', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

describe('PlaywrightPdfRenderer', () => {
  const launchMock = chromium.launch as jest.MockedFunction<typeof chromium.launch>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let renderer: PlaywrightPdfRenderer;
  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS') {
          return 2;
        }
        return '/bin/echo';
      }),
    };
    renderer = new PlaywrightPdfRenderer(
      configService as unknown as ConfigService,
    );
  });

  it('reuses one browser across multiple renders and closes contexts per render', async () => {
    let disconnectedHandler: (() => void) | undefined;
    const pageA = {
      route: jest.fn().mockResolvedValue(undefined),
      emulateMedia: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf-a')),
    };
    const pageB = {
      route: jest.fn().mockResolvedValue(undefined),
      emulateMedia: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf-b')),
    };
    const contextA = {
      newPage: jest.fn().mockResolvedValue(pageA),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const contextB = {
      newPage: jest.fn().mockResolvedValue(pageB),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browser = {
      newContext: jest
        .fn()
        .mockResolvedValueOnce(contextA)
        .mockResolvedValueOnce(contextB),
      on: jest.fn().mockImplementation((event: string, handler: () => void) => {
        if (event === 'disconnected') {
          disconnectedHandler = handler;
        }
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    launchMock.mockResolvedValue(browser as never);

    const first = await renderer.render({
      title: '첫 번째',
      html: '<p>first</p>',
    });
    const second = await renderer.render({
      title: '두 번째',
      html: '<p>second</p>',
    });

    expect(first.toString('utf-8')).toBe('pdf-a');
    expect(second.toString('utf-8')).toBe('pdf-b');
    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(launchMock.mock.calls[0]?.[0].args).not.toContain('--single-process');
    expect(browser.newContext).toHaveBeenCalledTimes(2);
    expect(contextA.close).toHaveBeenCalledTimes(1);
    expect(contextB.close).toHaveBeenCalledTimes(1);

    await renderer.onModuleDestroy();

    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(disconnectedHandler).toBeDefined();
  });

  it('aborts external requests while keeping inline resources available', async () => {
    let capturedHandler:
      | ((route: { request: () => { url: () => string }; continue: () => unknown; abort: () => unknown }) => unknown)
      | undefined;
    const page = {
      route: jest.fn().mockImplementation((_pattern, handler) => {
        capturedHandler = handler;
        return Promise.resolve();
      }),
      emulateMedia: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browser = {
      newContext: jest.fn().mockResolvedValue(context),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    launchMock.mockResolvedValue(browser as never);

    await renderer.render({
      title: '테스트',
      html: '<p>content</p>',
    });

    expect(capturedHandler).toBeDefined();
    if (!capturedHandler) {
      throw new Error('Expected route handler to be registered');
    }

    const allowRoute = {
      request: () => ({ url: () => 'data:text/plain;base64,QQ==' }),
      continue: jest.fn(),
      abort: jest.fn(),
    };
    const blockRoute = {
      request: () => ({ url: () => 'https://example.com/image.png' }),
      continue: jest.fn(),
      abort: jest.fn(),
    };

    await capturedHandler(allowRoute);
    await capturedHandler(blockRoute);

    expect(allowRoute.continue).toHaveBeenCalledTimes(1);
    expect(allowRoute.abort).not.toHaveBeenCalled();
    expect(blockRoute.abort).toHaveBeenCalledTimes(1);
    expect(blockRoute.continue).not.toHaveBeenCalled();
  });

  it('computes dynamic concurrency from cpu and memory when env override is missing', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'PLAYWRIGHT_PDF_MAX_CONCURRENT_RENDERS') {
        return null;
      }
      return '/bin/echo';
    });
    const privateRenderer = renderer as unknown as {
      getAvailableParallelism: () => number;
      getConstrainedMemoryBytes: () => number;
      getAvailableMemoryBytes: () => number;
      getMaxConcurrentRenders: () => number;
    };
    jest
      .spyOn(privateRenderer, 'getAvailableParallelism')
      .mockReturnValue(8);
    jest
      .spyOn(privateRenderer, 'getConstrainedMemoryBytes')
      .mockReturnValue(2 * 512 * 1024 * 1024);
    jest.spyOn(privateRenderer, 'getAvailableMemoryBytes').mockReturnValue(0);

    const maxConcurrentRenders = privateRenderer.getMaxConcurrentRenders();

    expect(maxConcurrentRenders).toBe(2);
  });

  it('relaunches a new browser after disconnect', async () => {
    let disconnectedHandler: (() => void) | undefined;
    const page = {
      route: jest.fn().mockResolvedValue(undefined),
      emulateMedia: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const firstBrowser = {
      newContext: jest.fn().mockResolvedValue(context),
      on: jest.fn().mockImplementation((event: string, handler: () => void) => {
        if (event === 'disconnected') {
          disconnectedHandler = handler;
        }
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const secondBrowser = {
      newContext: jest.fn().mockResolvedValue(context),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    launchMock
      .mockResolvedValueOnce(firstBrowser as never)
      .mockResolvedValueOnce(secondBrowser as never);

    await renderer.render({ title: '첫 번째', html: '<p>first</p>' });
    disconnectedHandler?.();
    await renderer.render({ title: '두 번째', html: '<p>second</p>' });

    expect(launchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once when browser-backed rendering fails with a retryable error', async () => {
    const failingContext = {
      newPage: jest
        .fn()
        .mockRejectedValue(
          new Error('Target page, context or browser has been closed'),
        ),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const succeedingPage = {
      route: jest.fn().mockResolvedValue(undefined),
      emulateMedia: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf-retried')),
    };
    const succeedingContext = {
      newPage: jest.fn().mockResolvedValue(succeedingPage),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const firstBrowser = {
      newContext: jest.fn().mockResolvedValue(failingContext),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const secondBrowser = {
      newContext: jest.fn().mockResolvedValue(succeedingContext),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    launchMock
      .mockResolvedValueOnce(firstBrowser as never)
      .mockResolvedValueOnce(secondBrowser as never);

    const pdf = await renderer.render({
      title: '재시도',
      html: '<p>retry</p>',
    });

    expect(pdf.toString('utf-8')).toBe('pdf-retried');
    expect(launchMock).toHaveBeenCalledTimes(2);
    expect(firstBrowser.close).toHaveBeenCalledTimes(1);
  });
});
