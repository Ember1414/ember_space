import type { APIRoute } from 'astro';
import { authenticate, json, publicUser } from '../../../lib/auth/http';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const auth = await authenticate(context);
    if (auth instanceof Response) return auth;
    return json({
      user: publicUser(auth.session.user),
      csrfToken: auth.session.csrfToken,
      session: { expiresAt: auth.session.expiresAt },
    });
  } catch {
    return new Response(JSON.stringify({ error: '认证服务暂时不可用。' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
};

