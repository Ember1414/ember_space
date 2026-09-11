import type { APIRoute } from 'astro';
import type { Role } from '../../../lib/db';
import { normalizeAccount } from '../../../lib/auth/account';
import { PASSWORD_HASH_ITERATIONS, sha256, verifyPassword } from '../../../lib/auth/crypto';
import { errorResponse, getRuntime, json, readJsonObject, trustedRequestOrigin } from '../../../lib/auth/http';
import {
  completeSuccessfulLogin,
  LOGIN_ATTEMPT_RETENTION_MS,
  LOGIN_ATTEMPT_WINDOW_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  reserveLoginAttempt,
} from '../../../lib/auth/login-rate-limit';
import { createSession, DEFAULT_SESSION_TTL_SECONDS, SESSION_COOKIE_NAME } from '../../../lib/auth/session';

export const prerender = false;

const DUMMY_HASH = `pbkdf2-sha256$${PASSWORD_HASH_ITERATIONS}$${'A'.repeat(43)}=`;
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA==';

interface CredentialRow {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  role: Role;
  active: number;
}

function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}

export const POST: APIRoute = async (context) => {
  try {
    const runtime = getRuntime(context);
    if (runtime instanceof Response) return runtime;
    if (!runtime.env.SESSION_SECRET) return errorResponse(503, '认证服务尚未配置。');
    if (!trustedRequestOrigin(context.request)) return errorResponse(403, '请求来源无效。');

    const body = await readJsonObject(context.request);
    if (!body) return errorResponse(400, '请求格式无效。');
    const username = normalizeAccount(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || username.length > 254 || !password || password.length > 256) {
      return errorResponse(401, '账号或密码不正确。');
    }

    const now = new Date();
    const attemptedAt = now.toISOString();
    const windowStart = new Date(now.getTime() - LOGIN_ATTEMPT_WINDOW_MS).toISOString();
    const cleanupBefore = new Date(now.getTime() - LOGIN_ATTEMPT_RETENTION_MS).toISOString();
    const ipHash = await sha256(`${runtime.env.SESSION_SECRET}:${clientIp(context.request)}`);
    const attemptId = await reserveLoginAttempt(runtime.db, {
      ipHash,
      email: username,
      attemptedAt,
      windowStart,
      cleanupBefore,
      maximum: MAX_FAILED_LOGIN_ATTEMPTS,
    });
    if (attemptId === null) {
      return json({ error: '登录尝试过于频繁，请稍后再试。', retryAfter: 900 }, 429, { 'retry-after': '900' });
    }

    const user = await runtime.db.prepare(
      `SELECT id, email, display_name AS displayName, password_hash AS passwordHash,
        password_salt AS passwordSalt, role, active FROM users WHERE email = ? LIMIT 1`,
    ).bind(username).first<CredentialRow>();
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_HASH,
      user?.passwordSalt ?? DUMMY_SALT,
    );

    if (!user || !user.active || !passwordMatches) {
      return errorResponse(401, '账号或密码不正确。');
    }

    await completeSuccessfulLogin(runtime.db, { attemptId, attemptedAt });

    const { token, session } = await createSession(runtime.db, user.id, now);
    context.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: new URL(context.request.url).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: DEFAULT_SESSION_TTL_SECONDS,
    });
    return json({
      user: { id: user.id, username: user.email, email: user.email, displayName: user.displayName, role: user.role, active: true },
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    });
  } catch {
    return errorResponse(500, '登录服务暂时不可用。');
  }
};
