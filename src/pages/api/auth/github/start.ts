import type { APIContext } from 'astro';
import { runtimeEnv } from '../../../../lib/db';
import { authenticate, errorResponse } from '../../../../lib/auth/http';
import {
  buildAuthorizeUrl,
  GITHUB_STATE_COOKIE,
  GITHUB_STATE_MAX_AGE_SECONDS,
  githubOAuthEnabled,
  newOAuthState,
} from '../../../../lib/auth/github';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const env = runtimeEnv(context.locals);
  if (!env?.DB || !githubOAuthEnabled(env)) return errorResponse(503, 'GitHub 登录尚未配置。');

  // mode=link 是已登录成员的绑定动作，必须持有效会话
  const mode = context.url.searchParams.get('mode') === 'link' ? 'link' : 'login';
  if (mode === 'link') {
    const auth = await authenticate(context);
    if (auth instanceof Response) return auth;
  }

  const state = newOAuthState(mode);
  context.cookies.set(GITHUB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: new URL(context.request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: GITHUB_STATE_MAX_AGE_SECONDS,
  });

  const redirectUri = new URL('/api/auth/github/callback', context.url).href;
  return context.redirect(buildAuthorizeUrl(env.GITHUB_CLIENT_ID!, state, redirectUri));
}
