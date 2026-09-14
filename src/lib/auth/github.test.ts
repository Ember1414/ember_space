import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl, githubOAuthEnabled, newOAuthState, parseOAuthState } from './github';

describe('githubOAuthEnabled', () => {
  it('两项配置齐全才启用', () => {
    expect(githubOAuthEnabled({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' })).toBe(true);
    expect(githubOAuthEnabled({ GITHUB_CLIENT_ID: 'id' })).toBe(false);
    expect(githubOAuthEnabled({ GITHUB_CLIENT_SECRET: 'secret' })).toBe(false);
    expect(githubOAuthEnabled({})).toBe(false);
    expect(githubOAuthEnabled(null)).toBe(false);
  });
});

describe('OAuth state', () => {
  it('生成的 state 可被解析回模式', () => {
    expect(parseOAuthState(newOAuthState('login'))).toEqual({ mode: 'login' });
    expect(parseOAuthState(newOAuthState('link'))).toEqual({ mode: 'link' });
  });

  it('拒绝畸形 state', () => {
    expect(parseOAuthState(null)).toBeNull();
    expect(parseOAuthState('')).toBeNull();
    expect(parseOAuthState('admin.token')).toBeNull();
    expect(parseOAuthState('.token')).toBeNull();
  });
});

describe('buildAuthorizeUrl', () => {
  it('携带 client_id、state、redirect_uri 与最小 scope', () => {
    const url = new URL(buildAuthorizeUrl('client-1', 'login.abc', 'https://example.com/api/auth/github/callback'));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('state')).toBe('login.abc');
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/api/auth/github/callback');
    expect(url.searchParams.get('scope')).toBe('read:user');
  });
});
