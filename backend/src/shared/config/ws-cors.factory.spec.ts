import { createWsCorsOriginHandler } from './ws-cors.factory';

describe('createWsCorsOriginHandler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.example.com',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows configured origins with callback(null, true)', () => {
    const callback = jest.fn();

    createWsCorsOriginHandler()('https://app.example.com', callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('denies unknown and missing origins with callback(null, false)', () => {
    const handler = createWsCorsOriginHandler();
    const callback = jest.fn();

    handler('https://evil.example.com', callback);
    handler(undefined, callback);

    expect(callback).toHaveBeenNthCalledWith(1, null, false);
    expect(callback).toHaveBeenNthCalledWith(2, null, false);
  });
});
