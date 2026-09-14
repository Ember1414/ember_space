import type { APIRoute } from 'astro';
import { authorizeRead, authorizeWrite, errorResponse, json, POST_JSON_BODY_LIMIT_BYTES, readJsonObject } from '../../../lib/auth/http';
import { canManageLinks } from '../../../lib/auth/policy';
import { getAllLinks, parseLinkInput } from '../../../lib/links';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await authorizeRead(context);
  if (auth instanceof Response) return auth;
  if (!canManageLinks(auth.session.user)) return errorResponse(403, '没有管理网址的权限。');
  const links = await getAllLinks(auth.db);
  return json({ links });
};

export const POST: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context);
    if (auth instanceof Response) return auth;
    if (!canManageLinks(auth.session.user)) return errorResponse(403, '没有管理网址的权限。');
    const body = await readJsonObject(context.request, POST_JSON_BODY_LIMIT_BYTES);
    if (!body) return errorResponse(400, '请求格式无效。');
    const parsed = parseLinkInput(body);
    if (!parsed.ok) return errorResponse(400, parsed.error);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await auth.db.prepare(
      'INSERT INTO links (id, title, url, description, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, parsed.value.title, parsed.value.url, parsed.value.description, parsed.value.category, now, now).run();
    return json({ id, link: { id, ...parsed.value, createdAt: now, updatedAt: now } }, 201);
  } catch {
    return errorResponse(500, '保存失败，请稍后重试。');
  }
};
