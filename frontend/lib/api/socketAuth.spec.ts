import { describe, expect, it } from 'vitest';
import { extractSocketErrorMessage, isSocketAuthError } from './socketAuth';

describe('socketAuth', () => {
  describe('extractSocketErrorMessage', () => {
    it('extracts message from string, Error, and object payloads', () => {
      expect(extractSocketErrorMessage(' Authentication expired ')).toBe(
        'Authentication expired',
      );
      expect(
        extractSocketErrorMessage(new Error('Invalid access token')),
      ).toBe('Invalid access token');
      expect(
        extractSocketErrorMessage({ message: 'Missing socket auth token' }),
      ).toBe('Missing socket auth token');
    });

    it('returns undefined for non-message payloads', () => {
      expect(extractSocketErrorMessage(null)).toBeUndefined();
      expect(extractSocketErrorMessage({})).toBeUndefined();
      expect(extractSocketErrorMessage({ message: 123 })).toBeUndefined();
    });
  });

  describe('isSocketAuthError', () => {
    it('returns true for auth-related messages', () => {
      expect(isSocketAuthError('Authentication expired')).toBe(true);
      expect(isSocketAuthError(new Error('Invalid access token'))).toBe(true);
      expect(isSocketAuthError({ message: 'Missing access token' })).toBe(
        true,
      );
    });

    it('returns false for non-auth messages', () => {
      expect(isSocketAuthError('meeting not found')).toBe(false);
      expect(isSocketAuthError({ message: 'Origin is not allowed' })).toBe(
        false,
      );
    });
  });
});
