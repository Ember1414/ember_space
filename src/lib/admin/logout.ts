export type AdminFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };
    return typeof payload.error === 'string' && payload.error ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export async function requestAdminLogout(fetcher: AdminFetch = fetch): Promise<void> {
  const meResponse = await fetcher('/api/auth/me', { credentials: 'include' });
  if (meResponse.status === 401) return;
  if (!meResponse.ok) {
    throw new Error(await errorMessage(meResponse, '无法确认当前会话，请稍后重试。'));
  }

  const me = await meResponse.json() as { csrfToken?: unknown };
  if (typeof me.csrfToken !== 'string' || !me.csrfToken) {
    throw new Error('无法取得退出凭据，请刷新页面后重试。');
  }

  const logoutResponse = await fetcher('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-csrf-token': me.csrfToken },
  });
  if (!logoutResponse.ok) {
    throw new Error(await errorMessage(logoutResponse, '退出失败，请稍后重试。'));
  }
}
