import { createHttpCorsOriginHandler } from './apply-global-app-config';

describe('createHttpCorsOriginHandler', () => {
  const handler = createHttpCorsOriginHandler({
    allowedOrigins: ['https://app.example.com'],
    nodeEnv: 'production',
  });

  it('allows configured origins with callback(null, true)', () => {
    const callback = jest.fn();

    handler('https://app.example.com', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('denies unknown origins with callback(null, false)', () => {
    const callback = jest.fn();

    handler('https://evil.example.com', callback);

    expect(callback).toHaveBeenCalledWith(null, false);
  });
});
