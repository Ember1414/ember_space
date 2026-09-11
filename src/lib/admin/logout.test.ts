import { describe, expect, it, vi } from 'vitest';
import { requestAdminLogout } from './logout';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('admin logout request', () => {
  it('revokes the session only after obtaining the CSRF token', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(requestAdminLogout(fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/auth/me', { credentials: 'include' });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': 'csrf-token' },
    });
  });

  it('does not report success when session lookup fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: '认证服务暂时不可用。' }, 500));

    await expect(requestAdminLogout(fetcher)).rejects.toThrow('认证服务暂时不可用');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not report success when revocation fails', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: '退出失败，请稍后重试。' }, 500));

    await expect(requestAdminLogout(fetcher)).rejects.toThrow('退出失败');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
