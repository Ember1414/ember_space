import { randomToken } from './crypto';

/** GitHub OAuth：成员登录（先绑定）与访客登录（自动创建 reader 账号）共用。 */

export const GITHUB_STATE_COOKIE = 'ember_github_oauth';
export const GITHUB_STATE_MAX_AGE_SECONDS = 600;

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export function githubOAuthEnabled(env: { GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string } | null | undefined): boolean {
  return Boolean(env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET);
}

/** state 编码模式（login / link）+ 随机 token，与 httpOnly cookie 双重校验防 CSRF。 */
export function newOAuthState(mode: 'login' | 'link'): string {
  return `${mode}.${randomToken()}`;
}

export function parseOAuthState(state: string | null): { mode: 'login' | 'link' } | null {
  if (!state) return null;
  const dot = state.indexOf('.');
  if (dot < 1) return null;
  const mode = state.slice(0, dot);
  if (mode !== 'login' && mode !== 'link') return null;
  return { mode };
}

export function buildAuthorizeUrl(clientId: string, state: string, redirectUri: string): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'read:user');
  return url.href;
}

export async function exchangeCodeForToken(code: string, config: GitHubOAuthConfig, redirectUri: string): Promise<string | null> {
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { access_token?: unknown };
    return typeof data.access_token === 'string' && data.access_token ? data.access_token : null;
  } catch {
    return null;
  }
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

/** 拉取 GitHub 公开资料（read:user scope）：id 用于绑定，login/name/avatar 用于自动建档。 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'ember-space',
      },
    });
    if (!response.ok) return null;
    const data = await response.json() as {
      id?: unknown;
      login?: unknown;
      name?: unknown;
      avatar_url?: unknown;
    };
    if (typeof data.id !== 'number' || !Number.isSafeInteger(data.id) || data.id <= 0) return null;
    if (typeof data.login !== 'string' || !data.login) return null;
    return {
      id: data.id,
      login: data.login,
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : null,
      avatarUrl: typeof data.avatar_url === 'string' && data.avatar_url ? data.avatar_url : null,
    };
  } catch {
    return null;
  }
}
