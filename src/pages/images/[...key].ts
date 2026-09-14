import type { APIContext } from 'astro';
import { runtimeEnv } from '../../lib/db';
import { isValidImageKey } from '../../lib/images';
import { getImage } from '../../lib/imageStore';

export const prerender = false;

function notFound(): Response {
  return new Response('Not found.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export async function GET(context: APIContext): Promise<Response> {
  const key = context.params.key ?? '';
  if (!isValidImageKey(key)) return notFound();

  const env = runtimeEnv(context.locals);
  if (!env?.IMAGES && !env?.IMAGES_KV) {
    return new Response('Image storage is temporarily unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '60' },
    });
  }

  const object = await getImage(env, key);
  if (!object) return notFound();

  // key 含 uuid 且内容永不变，可以永久缓存
  return new Response(object.body, {
    headers: {
      'content-type': object.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      ...(object.etag ? { etag: object.etag } : {}),
    },
  });
}
