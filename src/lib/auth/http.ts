import type { APIContext } from 'astro';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { type D1DatabaseLike, type Role, type RuntimeEnv } from '../db';
import { constantTimeEqual } from './crypto';
import { trustedRequestOrigin } from './origin';
import { canManageMembers } from './policy';
import { readSession, SESSION_COOKIE_NAME, type AuthSession } from './session';

export interface AuthContext {
  db: D1DatabaseLike;
  env: RuntimeEnv;
  session: AuthSession;
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(status: number, error: string): Response {
  return json({ error }, status);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null;
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export { trustedRequestOrigin } from './origin';

export function getRuntime(context: APIContext): { env: RuntimeEnv; db: D1DatabaseLike } | Response {
  void context;
  const env = cloudflareEnv as RuntimeEnv;
  if (!env?.DB) return errorResponse(503, '数据库暂时不可用。');
  return { env, db: env.DB };
}

export async function authenticate(context: APIContext): Promise<AuthContext | Response> {
  const runtime = getRuntime(context);
  if (runtime instanceof Response) return runtime;
  const token = context.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSession(runtime.db, token);
  if (!session) return errorResponse(401, '登录已失效，请重新登录。');
  return { ...runtime, session };
}

export async function authorizeWrite(context: APIContext, role?: Role): Promise<AuthContext | Response> {
  const auth = await authenticate(context);
  if (auth instanceof Response) return auth;
  if (role === 'owner' && !canManageMembers(auth.session.user)) {
    return errorResponse(403, '只有所有者可以执行此操作。');
  }
  if (!trustedRequestOrigin(context.request)) return errorResponse(403, '请求来源无效。');
  const csrf = context.request.headers.get('x-csrf-token') ?? '';
  if (!csrf || !constantTimeEqual(csrf, auth.session.csrfToken)) {
    return errorResponse(403, 'CSRF 校验失败，请刷新页面后重试。');
  }
  return auth;
}

export async function authorizeRead(context: APIContext, role?: Role): Promise<AuthContext | Response> {
  const auth = await authenticate(context);
  if (auth instanceof Response) return auth;
  if (role === 'owner' && !canManageMembers(auth.session.user)) {
    return errorResponse(403, '只有所有者可以执行此操作。');
  }
  return auth;
}

export function publicUser(user: AuthSession['user']): AuthSession['user'] & { username: string; status: string } {
  return { ...user, username: user.email, status: user.active ? 'active' : 'suspended' };
}
