import type { APIRoute } from 'astro';
import { authorizeWrite, errorResponse, json, POST_JSON_BODY_LIMIT_BYTES, readJsonObject } from '../../../lib/auth/http';
import { canManageLinks } from '../../../lib/auth/policy';
import { parseLinkInput } from '../../../lib/links';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context);
    if (auth instanceof Response) return auth;
    if (!canManageLinks(auth.session.user)) return errorResponse(403, '没有管理网址的权限。');
    const id = context.params.id ?? '';
    const existing = await auth.db.prepare('SELECT id FROM links WHERE id = ? LIMIT 1').bind(id).first();
    if (!existing) return errorResponse(404, '网址不存在。');
    const body = await readJsonObject(context.request, POST_JSON_BODY_LIMIT_BYTES);
    if (!body) return errorResponse(400, '请求格式无效。');
    const parsed = parseLinkInput(body);
    if (!parsed.ok) return errorResponse(400, parsed.error);
    const now = new Date().toISOString();
    await auth.db.prepare(
      'UPDATE links SET title = ?, url = ?, description = ?, category = ?, updated_at = ? WHERE id = ?',
    ).bind(parsed.value.title, parsed.value.url, parsed.value.description, parsed.value.category, now, id).run();
    return json({ id, link: { id, ...parsed.value, updatedAt: now } });
  } catch {
    return errorResponse(500, '保存失败，请稍后重试。');
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context);
    if (auth instanceof Response) return auth;
    if (!canManageLinks(auth.session.user)) return errorResponse(403, '没有管理网址的权限。');
    const id = context.params.id ?? '';
    const result = await auth.db.prepare('DELETE FROM links WHERE id = ?').bind(id).run();
    if (!Number(result.meta.changes ?? 0)) return errorResponse(404, '网址不存在。');
    return json({ ok: true });
  } catch {
    return errorResponse(500, '删除失败，请稍后重试。');
  }
};
