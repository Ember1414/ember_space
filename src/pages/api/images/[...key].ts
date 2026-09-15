import type { APIContext } from 'astro';
import { authorizeWrite, errorResponse, json } from '../../../lib/auth/http';
import { canUploadImages } from '../../../lib/auth/policy';
import { isValidImageKey } from '../../../lib/images';
import { deleteImage, imageStorageAvailable } from '../../../lib/imageStore';

export const prerender = false;

/** 从图片存储（KV/R2）中永久删除一张图片；仅内容作者可操作。
 *  key 形如 2026/09/uuid.png（含斜杠），必须用 [...key] 通配路由才能匹配。 */
export async function DELETE(context: APIContext): Promise<Response> {
  const auth = await authorizeWrite(context);
  if (auth instanceof Response) return auth;
  if (!canUploadImages(auth.session.user)) return errorResponse(403, '没有管理图片的权限。');
  if (!imageStorageAvailable(auth.env)) return errorResponse(503, '图片存储暂时不可用。');

  const key = context.params.key ?? '';
  if (!isValidImageKey(key)) return errorResponse(400, '图片地址无效。');

  try {
    await deleteImage(auth.env, key);
  } catch {
    return errorResponse(500, '删除失败，请稍后重试。');
  }
  return json({ ok: true });
}
