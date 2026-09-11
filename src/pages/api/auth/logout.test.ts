import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeWrite: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('../../../lib/auth/http', () => ({
  authorizeWrite: mocks.authorizeWrite,
  json: (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  }),
  errorResponse: (status: number, error: string) => new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  }),
}));

vi.mock('../../../lib/auth/session', () => ({
  revokeSession: mocks.revokeSession,
  SESSION_COOKIE_NAME: 'ember_session',
}));

import { POST } from './logout';

describe('logout endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the cookie when database revocation fails', async () => {
    const deleteCookie = vi.fn();
    mocks.authorizeWrite.mockResolvedValue({ db: {} });
    mocks.revokeSession.mockRejectedValue(new Error('D1 unavailable'));
    const context = {
      cookies: {
        get: () => ({ value: 'session-token' }),
        delete: deleteCookie,
      },
    } as never;

    const response = await POST(context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: '退出失败，请稍后重试。' });
    expect(deleteCookie).not.toHaveBeenCalled();
  });
});
