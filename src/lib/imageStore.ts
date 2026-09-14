/** 图片存储适配层：优先 R2，未开通 R2 时自动回退到 KV（免绑卡方案）。 */
import type { RuntimeEnv } from './db';
import { IMAGE_CONTENT_TYPES, type ImageFormat } from './images';

export interface ImageObject {
  body: ReadableStream | ArrayBuffer;
  contentType: string;
  etag?: string;
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

/** KV 不支持按值携带 metadata；key 由本系统生成且必带扩展名，content-type 可由 key 推导。 */
export function contentTypeFromKey(key: string): string {
  const dot = key.lastIndexOf('.');
  const extension = dot === -1 ? '' : key.slice(dot + 1).toLowerCase();
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/** 图片存储是否可用（R2 与 KV 至少绑定其一）。 */
export function imageStorageAvailable(env: RuntimeEnv | null | undefined): boolean {
  return Boolean(env?.IMAGES || env?.IMAGES_KV);
}

export async function putImage(
  env: RuntimeEnv,
  key: string,
  bytes: Uint8Array,
  format: ImageFormat,
): Promise<void> {
  if (env.IMAGES) {
    await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: IMAGE_CONTENT_TYPES[format] } });
    return;
  }
  if (env.IMAGES_KV) {
    await env.IMAGES_KV.put(key, bytes);
    return;
  }
  throw new Error('image storage unavailable');
}

export async function getImage(env: RuntimeEnv, key: string): Promise<ImageObject | null> {
  if (env.IMAGES) {
    const object = await env.IMAGES.get(key);
    if (!object?.body) return null;
    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType ?? contentTypeFromKey(key),
      etag: object.etag,
    };
  }
  if (env.IMAGES_KV) {
    const bytes = await env.IMAGES_KV.get(key, 'arrayBuffer');
    if (!bytes) return null;
    return { body: bytes, contentType: contentTypeFromKey(key) };
  }
  return null;
}
