import { describe, expect, it } from 'vitest';
import { canConsumeInvite, inviteState } from './invites';

describe('one-time invites', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');

  it('accepts an unused invite before expiry', () => {
    const invite = { expiresAt: '2026-09-12T12:00:00.000Z', usedAt: null };
    expect(inviteState(invite, now)).toBe('pending');
    expect(canConsumeInvite(invite, now)).toBe(true);
  });

  it('cannot consume an invite after it has been used', () => {
    const invite = { expiresAt: '2026-09-12T12:00:00.000Z', usedAt: '2026-09-11T12:00:01.000Z' };
    expect(inviteState(invite, now)).toBe('used');
    expect(canConsumeInvite(invite, now)).toBe(false);
  });

  it('cannot consume an invite at or after expiry', () => {
    expect(canConsumeInvite({ expiresAt: now.toISOString(), usedAt: null }, now)).toBe(false);
    expect(inviteState({ expiresAt: '2026-09-10T12:00:00.000Z', usedAt: null }, now)).toBe('expired');
  });
});

