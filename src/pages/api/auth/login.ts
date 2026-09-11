import type { APIRoute } from 'astro';
import type { Role } from '../../../lib/db';
import { sha256, verifyPassword } from '../../../lib/auth/crypto';
import { errorResponse, getRuntime, json, readJsonObject, trustedRequestOrigin } from '../../../lib/auth/http';
import { createSession, DEFAULT_SESSION_TTL_SECONDS, SESSION_COOKIE_NAME } from '../../../lib/auth/session';

export const prerender = false;

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const DUMMY_HASH = `pbkdf2-sha256$210000$${'A'.repeat(43)}=`;
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
    const username = typeof body.username === 'string' ? body.username.normalize('NFKC').trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || username.length > 254 || !password || password.length > 256) {
      return errorResponse(401, '账号或密码不正确。');
    }

    const now = new Date();
    const attemptedAt = now.toISOString();
    const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MS).toISOString();
    const ipHash = await sha256(`${runtime.env.SESSION_SECRET}:${clientIp(context.request)}`);
    const recent = await runtime.db.prepare(
      `SELECT COUNT(*) AS count FROM login_attempts
       WHERE successful = 0 AND attempted_at >= ? AND (ip_hash = ? OR email = ?)`,
    ).bind(windowStart, ipHash, username).first<{ count: number }>();
    if (Number(recent?.count ?? 0) >= MAX_FAILED_ATTEMPTS) {
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
      await runtime.db.prepare(
        'INSERT INTO login_attempts (ip_hash, email, attempted_at, successful) VALUES (?, ?, ?, 0)',
      ).bind(ipHash, username, attemptedAt).run();
      return errorResponse(401, '账号或密码不正确。');
    }

    await runtime.db.batch([
      runtime.db.prepare(
        'INSERT INTO login_attempts (ip_hash, email, attempted_at, successful) VALUES (?, ?, ?, 1)',
      ).bind(ipHash, username, attemptedAt),
      runtime.db.prepare(
        'DELETE FROM login_attempts WHERE successful = 0 AND (ip_hash = ? OR email = ?)',
      ).bind(ipHash, username),
      runtime.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(attemptedAt),
      runtime.db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(
        new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      ),
    ]);

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

