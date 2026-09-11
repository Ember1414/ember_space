import type { APIRoute } from 'astro';
import { authorizeWrite, errorResponse, json } from '../../../lib/auth/http';
import { revokeSession, SESSION_COOKIE_NAME } from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context);
    if (auth instanceof Response) return auth;
    await revokeSession(auth.db, context.cookies.get(SESSION_COOKIE_NAME)?.value);
    context.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    return json({ ok: true });
  } catch {
    return errorResponse(500, '退出失败，请稍后重试。');
  }
};
