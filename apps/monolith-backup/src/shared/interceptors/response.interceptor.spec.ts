import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  it('wraps success responses and strips internal ownerSub fields', async () => {
    const interceptor = new ResponseInterceptor();
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () =>
        of({
          id: 'meeting-1',
          ownerSub: 'user-1',
          nested: {
            ownerSub: 'user-1',
            visible: true,
          },
          items: [
            {
              id: 'prompt-1',
              ownerSub: 'user-1',
            },
          ],
        }),
    } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({
      success: true,
      data: {
        id: 'meeting-1',
        nested: {
          visible: true,
        },
        items: [
          {
            id: 'prompt-1',
          },
        ],
      },
    });
  });
});
