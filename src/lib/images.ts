/** 图片类型校验、大小限制与存储 key 生成。纯函数，服务端与测试共用。 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'avif';

export const IMAGE_CONTENT_TYPES: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

const EXTENSIONS: Record<ImageFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  gif: 'gif',
  webp: 'webp',
  avif: 'avif',
};

function hasPrefix(bytes: Uint8Array, prefix: number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  return prefix.every((value, index) => bytes[offset + index] === value);
}

/** 按文件头 magic bytes 识别图片格式；不信任客户端提供的 Content-Type。 */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  if (
    hasPrefix(bytes, [0x66, 0x74, 0x79, 0x70], 4)
    && (hasPrefix(bytes, [0x61, 0x76, 0x69, 0x66], 8) || hasPrefix(bytes, [0x61, 0x76, 0x69, 0x73], 8))
  ) return 'avif';
  return null;
}

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY_PATTERN = new RegExp(`^(?:\\d{4}/\\d{2}|avatars/[a-z0-9-]+)/${UUID_PATTERN}\\.(?:png|jpe?g|gif|webp|avif)$`);

/** 服务端生成存储 key：文章图按 UTC 年月分目录，头像按用户分目录。客户端不可指定路径。 */
export function newImageKey(format: ImageFormat, scope?: { kind: 'avatar'; userId: string }, now = new Date()): string {
  const uuid = crypto.randomUUID();
  const ext = EXTENSIONS[format];
  if (scope?.kind === 'avatar') return `avatars/${scope.userId}/${uuid}.${ext}`;
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${uuid}.${ext}`;
}

/** 读取路径校验：只接受本系统生成的 key 形态，拒绝路径穿越。 */
export function isValidImageKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}
