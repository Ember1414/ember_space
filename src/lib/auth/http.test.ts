import { describe, expect, it } from 'vitest';
import { trustedRequestOrigin } from './origin';

describe('write request origin checks', () => {
  it('accepts an exact same-origin request', () => {
    const request = new Request('https://ember.example/api/posts', { headers: { origin: 'https://ember.example' } });
    expect(trustedRequestOrigin(request)).toBe(true);
  });

  it('rejects cross-origin and missing-origin requests', () => {
    const crossOrigin = new Request('https://ember.example/api/posts', { headers: { origin: 'https://attacker.example' } });
    expect(trustedRequestOrigin(crossOrigin)).toBe(false);
    expect(trustedRequestOrigin(new Request('https://ember.example/api/posts'))).toBe(false);
  });
});
