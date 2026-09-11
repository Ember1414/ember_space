import { describe, expect, it, vi } from 'vitest';
import { readJsonObject } from './http';
import { trustedRequestOrigin } from './origin';

vi.mock('cloudflare:workers', () => ({ env: {} }));

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

describe('JSON request limits', () => {
  it('parses an object whose encoded body is within the limit', async () => {
    const request = new Request('https://ember.example/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ember' }),
    });

    await expect(readJsonObject(request, 64)).resolves.toEqual({ username: 'ember' });
  });

  it('rejects a streamed body once it exceeds the byte limit', async () => {
    const request = new Request('https://ember.example/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'x'.repeat(80) }),
    });

    await expect(readJsonObject(request, 32)).resolves.toBeNull();
  });
});
