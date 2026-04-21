import {
  getRequestContext,
  runWithRequestContext,
  updateRequestContext,
} from './request-context.storage';

describe('request-context.storage', () => {
  it('creates and exposes a request context', () => {
    runWithRequestContext(
      { requestId: 'req-1', meetingId: 'meeting-1' },
      () => {
        expect(getRequestContext()).toEqual({
          requestId: 'req-1',
          meetingId: 'meeting-1',
        });
      },
    );
  });

  it('merges patches into the active context', () => {
    runWithRequestContext({ requestId: 'req-2', transport: 'http' }, () => {
      updateRequestContext({
        ownerSub: 'user-1',
        meetingId: 'meeting-2',
      });

      expect(getRequestContext()).toEqual({
        requestId: 'req-2',
        transport: 'http',
        ownerSub: 'user-1',
        meetingId: 'meeting-2',
      });
    });
  });
});
