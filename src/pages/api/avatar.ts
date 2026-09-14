import type { APIContext } from 'astro';
import { authorizeWrite, errorResponse, json } from '../../lib/auth/http';
import { newImageKey, sniffImageFormat } from '../../lib/images';
import { imageStorageAvailable, putImage } from '../../lib/imageStore';
import { setAvatarUrl } from '../../lib/profile';

export const prerender = false;

// 头像在客户端已压缩为 256×256，服务端再收紧到 2MB
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export async function POST(context: APIContext): Promise<Response> {
  const auth = await authorizeWrite(context);
  if (auth instanceof Response) return auth;
  if (!imageStorageAvailable(auth.env)) return errorResponse(503, '图片存储暂时不可用。');

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return errorResponse(400, '请求格式无效。');
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return errorResponse(400, '缺少头像文件。');
  if (file.size > AVATAR_MAX_BYTES) return errorResponse(413, '头像不能超过 2MB。');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = sniffImageFormat(bytes);
  if (!format || format === 'gif' || format === 'avif') {
    return errorResponse(415, '头像仅支持 PNG / JPEG / WebP 格式。');
  }

  const userId = auth.session.user.id;
  const key = newImageKey(format, { kind: 'avatar', userId });
  await putImage(auth.env, key, bytes, format);

  const url = `/images/${key}`;
  await setAvatarUrl(auth.db, userId, url);
  return json({ url }, 201);
}
