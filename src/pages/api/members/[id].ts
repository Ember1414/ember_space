import type { APIRoute } from 'astro';
import { authorizeWrite, errorResponse, json, readJsonObject } from '../../../lib/auth/http';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context, 'owner');
    if (auth instanceof Response) return auth;
    const id = context.params.id ?? '';
    const body = await readJsonObject(context.request);
    if (!body) return errorResponse(400, '请求格式无效。');
    const active = typeof body.active === 'boolean'
      ? body.active
      : body.status === 'active' ? true : body.status === 'suspended' ? false : null;
    if (active === null) return errorResponse(400, '成员状态无效。');
    if (id === auth.session.user.id) return errorResponse(409, '不能暂停所有者账号。');

    const [updated] = await auth.db.batch([
      auth.db.prepare(
        `UPDATE users SET active = ?, updated_at = ? WHERE id = ? AND role = 'editor'`,
      ).bind(active ? 1 : 0, new Date().toISOString(), id),
      auth.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    ]);
    if (Number(updated.meta.changes ?? 0) !== 1) return errorResponse(404, '成员不存在。');
    return json({ member: { id, active, status: active ? 'active' : 'suspended' } });
  } catch {
    return errorResponse(500, '成员状态更新失败。');
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const auth = await authorizeWrite(context, 'owner');
    if (auth instanceof Response) return auth;
    const id = context.params.id ?? '';
    if (id === auth.session.user.id) return errorResponse(409, '不能删除所有者账号。');
    const target = await auth.db.prepare("SELECT id FROM users WHERE id = ? AND role = 'editor'").bind(id).first();
    if (!target) return errorResponse(404, '成员不存在。');
    await auth.db.prepare("DELETE FROM users WHERE id = ? AND role = 'editor'").bind(id).run();
    return json({ ok: true });
  } catch {
    return errorResponse(500, '成员删除失败。');
  }
};
