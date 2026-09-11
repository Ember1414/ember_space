import type { APIRoute } from 'astro';
import { authorizeWrite, json } from '../../../lib/auth/http';
import { revokeSession, SESSION_COOKIE_NAME } from '../../../lib/auth/session';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = await authorizeWrite(context);
  if (auth instanceof Response) return auth;
  await revokeSession(auth.db, context.cookies.get(SESSION_COOKIE_NAME)?.value);
  context.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
  return json({ ok: true });
};

