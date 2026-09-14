import type { APIContext } from 'astro';
import { runtimeEnv } from '../../../lib/db';
import { githubOAuthEnabled } from '../../../lib/auth/github';
import { json } from '../../../lib/auth/http';

export const prerender = false;

/** 登录页据此决定是否展示 GitHub 登录入口；未配置时入口完全隐藏。 */
export function GET(context: APIContext): Response {
  return json({ github: githubOAuthEnabled(runtimeEnv(context.locals)) });
}
