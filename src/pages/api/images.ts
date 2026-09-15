import type { APIContext } from 'astro';
import { authorizeRead, authorizeWrite, errorResponse, json } from '../../lib/auth/http';
import { canUploadImages } from '../../lib/auth/policy';
import { MAX_IMAGE_BYTES, newImageKey, sniffImageFormat } from '../../lib/images';
import { imageStorageAvailable, listImages, putImage } from '../../lib/imageStore';

export const prerender = false;

/** 编辑器图片库：列出存储中的图片（仅内容作者）。 */
export async function GET(context: APIContext): Promise<Response> {
  const auth = await authorizeRead(context);
  if (auth instanceof Response) return auth;
  if (!canUploadImages(auth.session.user)) return errorResponse(403, '没有管理图片的权限。');
  if (!imageStorageAvailable(auth.env)) return errorResponse(503, '图片存储暂时不可用。');
  const images = await listImages(auth.env, 200);
  return json({ images });
}

export async function POST(context: APIContext): Promise<Response> {
  const auth = await authorizeWrite(context);
  if (auth instanceof Response) return auth;
  if (!canUploadImages(auth.session.user)) return errorResponse(403, '没有上传图片的权限。');
  if (!imageStorageAvailable(auth.env)) return errorResponse(503, '图片存储暂时不可用。');

  // multipart 边界与字段会占少量额外字节，预检留出余量
  const declaredLength = Number(context.request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return errorResponse(413, '图片不能超过 5MB。');
  }

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return errorResponse(400, '请求格式无效。');
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return errorResponse(400, '缺少图片文件。');
  if (file.size > MAX_IMAGE_BYTES) return errorResponse(413, '图片不能超过 5MB。');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = sniffImageFormat(bytes);
  if (!format) return errorResponse(415, '仅支持 PNG / JPEG / GIF / WebP / AVIF 图片。');

  const key = newImageKey(format);
  await putImage(auth.env, key, bytes, format);
  return json({ url: `/images/${key}`, key }, 201);
}
