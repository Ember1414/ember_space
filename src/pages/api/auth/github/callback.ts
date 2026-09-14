import type { APIContext } from 'astro';
import { runtimeEnv, type Role } from '../../../../lib/db';
import { authenticate } from '../../../../lib/auth/http';
import { constantTimeEqual } from '../../../../lib/auth/crypto';
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  GITHUB_STATE_COOKIE,
  githubOAuthEnabled,
  parseOAuthState,
} from '../../../../lib/auth/github';
import { createSession, DEFAULT_SESSION_TTL_SECONDS, SESSION_COOKIE_NAME } from '../../../../lib/auth/session';

export const prerender = false;

const READER_HOME = '/account/';

function redirectTo(path: string): Response {
  return new Response(null, { status: 302, headers: { location: path, 'cache-control': 'no-store' } });
}

// 访客 OAuth 失败的落点是前台个人中心；后台绑定流程的失败仍回后台页面
const loginError = (code: string) => redirectTo(`${READER_HOME}?error=${code}`);

export async function GET(context: APIContext): Promise<Response> {
  const env = runtimeEnv(context.locals);
  if (!env?.DB || !githubOAuthEnabled(env)) return loginError('github-unavailable');

  const expectedState = context.cookies.get(GITHUB_STATE_COOKIE)?.value ?? '';
  const actualState = context.url.searchParams.get('state') ?? '';
  context.cookies.delete(GITHUB_STATE_COOKIE, { path: '/' });
  const parsed = parseOAuthState(actualState);
  if (!parsed || !(await constantTimeEqual(actualState, expectedState))) {
    return loginError('github-state');
  }

  const code = context.url.searchParams.get('code') ?? '';
  if (!code || code.length > 512) return loginError('github-denied');

  const redirectUri = new URL('/api/auth/github/callback', context.url).href;
  const accessToken = await exchangeCodeForToken(
    code,
    { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! },
    redirectUri,
  );
  const githubUser = accessToken ? await fetchGitHubUser(accessToken) : null;
  if (!githubUser) return loginError('github-exchange');

  if (parsed.mode === 'link') {
    const auth = await authenticate(context);
    if (auth instanceof Response) return redirectTo('/admin/login/');
    // 一个 GitHub 账号只能绑定一个成员
    const existing = await auth.db.prepare('SELECT id FROM users WHERE github_id = ? LIMIT 1')
      .bind(githubUser.id)
      .first<{ id: string }>();
    if (existing && existing.id !== auth.session.user.id) {
      return redirectTo('/admin/settings/?error=github-taken');
    }
    await auth.db.prepare('UPDATE users SET github_id = ?, updated_at = ? WHERE id = ?')
      .bind(githubUser.id, new Date().toISOString(), auth.session.user.id)
      .run();
    return redirectTo('/admin/settings/?linked=github');
  }

  // mode=login：已绑定账号直接登录；未绑定的 GitHub 账号自动创建 reader（仅评论身份，无后台权限）
  let user = await env.DB.prepare('SELECT id, role, active FROM users WHERE github_id = ? LIMIT 1')
    .bind(githubUser.id)
    .first<{ id: string; role: Role; active: number }>();

  if (!user) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    // 合成邮箱：稳定唯一、无人知晓，reader 因此无法走账密登录
    const email = `gh_${githubUser.id}@github.local`;
    const displayName = (githubUser.name || githubUser.login).slice(0, 50);
    await env.DB.prepare(
      `INSERT INTO users (id, email, display_name, role, active, created_at, updated_at, avatar_url, github_id)
       VALUES (?, ?, ?, 'reader', 1, ?, ?, ?, ?)`,
    ).bind(id, email, displayName, now, now, githubUser.avatarUrl, githubUser.id).run();
    user = { id, role: 'reader', active: 1 };
  }
  if (!user.active) return loginError('github-disabled');

  const { token } = await createSession(env.DB, user.id);
  context.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(context.request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: DEFAULT_SESSION_TTL_SECONDS,
  });
  return redirectTo(user.role === 'reader' ? READER_HOME : '/admin/');
}
