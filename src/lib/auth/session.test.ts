import { describe, expect, it } from 'vitest';
import { isSessionExpired } from './session';

describe('session expiry', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');

  it('keeps a session valid strictly before its expiry', () => {
    expect(isSessionExpired('2026-09-11T12:00:00.001Z', now)).toBe(false);
  });

  it('expires a session at its boundary and afterwards', () => {
    expect(isSessionExpired('2026-09-11T12:00:00.000Z', now)).toBe(true);
    expect(isSessionExpired('2026-09-11T11:59:59.999Z', now)).toBe(true);
  });

  it('fails closed for an invalid timestamp', () => {
    expect(isSessionExpired('not-a-date', now)).toBe(true);
  });
});

