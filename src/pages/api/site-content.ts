import type { APIContext } from 'astro';
import { authorizeRead, authorizeWrite, errorResponse, json, readJsonObject } from '../../lib/auth/http';
import { canManageMembers } from '../../lib/auth/policy';
import { getAllAboutContent, parseAboutContent, setAboutContent } from '../../lib/siteContent';

export const prerender = false;

/** 关于页站点内容：所有者专用。GET 读取两个语言的当前值，PUT 更新其中一个语言。 */
export async function GET(context: APIContext): Promise<Response> {
  const auth = await authorizeRead(context);
  if (auth instanceof Response) return auth;
  if (!canManageMembers(auth.session.user)) return errorResponse(403, '只有所有者可以编辑站点内容。');
  const about = await getAllAboutContent(auth.db);
  return json({ about });
}

export async function PUT(context: APIContext): Promise<Response> {
  const auth = await authorizeWrite(context);
  if (auth instanceof Response) return auth;
  if (!canManageMembers(auth.session.user)) return errorResponse(403, '只有所有者可以编辑站点内容。');

  const body = await readJsonObject(context.request);
  if (!body) return errorResponse(400, '请求格式无效。');

  const lang = body.lang;
  if (lang !== 'zh' && lang !== 'en') return errorResponse(400, '语言无效。');

  const parsed = parseAboutContent(body);
  if (!parsed.ok) return errorResponse(400, parsed.error);

  await setAboutContent(auth.db, lang, parsed.value);
  return json({ lang, content: parsed.value });
}
