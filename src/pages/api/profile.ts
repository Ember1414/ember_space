import type { APIContext } from 'astro';
import { authorizeRead, authorizeWrite, errorResponse, json, readJsonObject } from '../../lib/auth/http';
import { getProfile, updateProfile, validateBio, validateDisplayName } from '../../lib/profile';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const auth = await authorizeRead(context);
  if (auth instanceof Response) return auth;
  const profile = await getProfile(auth.db, auth.session.user.id);
  if (!profile) return errorResponse(404, '账号不存在。');
  return json({ profile });
}

export async function PATCH(context: APIContext): Promise<Response> {
  const auth = await authorizeWrite(context);
  if (auth instanceof Response) return auth;

  const body = await readJsonObject(context.request);
  if (!body) return errorResponse(400, '请求格式无效。');

  const updates: { displayName?: string; bio?: string } = {};
  if ('displayName' in body) {
    const name = validateDisplayName(body.displayName);
    if (!name) return errorResponse(400, '显示名不能为空且不能超过 50 个字符。');
    updates.displayName = name;
  }
  if ('bio' in body) {
    const bio = validateBio(body.bio);
    if (bio === null) return errorResponse(400, '个人简介不能超过 160 个字符。');
    updates.bio = bio;
  }
  if (!Object.keys(updates).length) return errorResponse(400, '没有需要更新的字段。');

  await updateProfile(auth.db, auth.session.user.id, updates);
  const profile = await getProfile(auth.db, auth.session.user.id);
  return json({ profile });
}
