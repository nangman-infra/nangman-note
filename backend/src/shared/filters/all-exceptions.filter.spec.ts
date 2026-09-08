import {
  ArgumentsHost,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    statusCode: number;
    message: string;
    path: string;
    timestamp: string;
  };
}

function createHttpHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock<void, [ApiErrorEnvelope]>;
  response: { headersSent: boolean };
} {
  const json = jest.fn<void, [ApiErrorEnvelope]>();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status, json, headersSent: false };
  const request = {
    method: 'GET',
    url: '/api/v1/meetings',
    originalUrl: '/api/v1/meetings',
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json, response };
}

describe('AllExceptionsFilter', () => {
  it('serializes HttpExceptions into the standard error envelope', () => {
    const filter = new AllExceptionsFilter('development');
    const { host, status, json } = createHttpHost();

    filter.catch(
      new UnauthorizedException('Missing Authorization header'),
      host,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledTimes(1);
    const envelope = json.mock.calls[0][0];
    expect(envelope.success).toBe(false);
    expect(envelope.error).toMatchObject({
      code: 'UnauthorizedException',
      statusCode: 401,
      message: 'Missing Authorization header',
      path: '/api/v1/meetings',
    });
    expect(typeof envelope.error.timestamp).toBe('string');
  });

  it('joins validation message arrays', () => {
    const filter = new AllExceptionsFilter('development');
    const { host, json } = createHttpHost();

    filter.catch(
      new BadRequestException(['a must be set', 'b must be set']),
      host,
    );

    expect(json.mock.calls[0][0].error.message).toBe(
      'a must be set, b must be set',
    );
  });

  it('masks unexpected errors in production', () => {
    const filter = new AllExceptionsFilter('production');
    const { host, status, json } = createHttpHost();

    filter.catch(new Error('db password leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].error).toMatchObject({
      code: 'Error',
      statusCode: 500,
      message: 'Internal server error',
    });
  });

  it('does not touch the HTTP response for non-http contexts', () => {
    const filter = new AllExceptionsFilter('development');
    const switchToHttp = jest.fn();
    const host = {
      getType: () => 'ws',
      switchToHttp,
    } as unknown as ArgumentsHost;

    expect(() => filter.catch(new Error('socket boom'), host)).not.toThrow();
    expect(switchToHttp).not.toHaveBeenCalled();
  });

  it('skips writing when headers were already sent', () => {
    const filter = new AllExceptionsFilter('development');
    const { host, status, response } = createHttpHost();
    response.headersSent = true;

    filter.catch(new Error('late failure'), host);

    expect(status).not.toHaveBeenCalled();
  });
});
