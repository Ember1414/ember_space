import { describe, expect, it } from 'vitest';
import { contentTypeFromKey, getImage, imageStorageAvailable, putImage } from './imageStore';
import type { KVNamespaceLike, R2BucketLike } from './db';

class FakeR2 implements R2BucketLike {
  objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();

  async put(key: string, value: Uint8Array | ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }) {
    const bytes = value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array();
    this.objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
  }

  async get(key: string) {
    const found = this.objects.get(key);
    if (!found) return null;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(found.bytes);
        controller.close();
      },
    });
    return { body: stream, httpMetadata: { contentType: found.contentType }, etag: 'fake-etag' };
  }
}

class FakeKV implements KVNamespaceLike {
  entries = new Map<string, ArrayBuffer>();

  async get(key: string, type: 'arrayBuffer') {
    if (type !== 'arrayBuffer') throw new Error('unsupported type');
    return this.entries.get(key) ?? null;
  }

  async put(key: string, value: ArrayBuffer | Uint8Array) {
    this.entries.set(key, value instanceof Uint8Array ? value.slice().buffer : value);
  }
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('contentTypeFromKey', () => {
  it('按扩展名推导 content-type', () => {
    expect(contentTypeFromKey('2026/09/abc.png')).toBe('image/png');
    expect(contentTypeFromKey('2026/09/abc.jpg')).toBe('image/jpeg');
    expect(contentTypeFromKey('avatars/u1/abc.webp')).toBe('image/webp');
    expect(contentTypeFromKey('avatars/u1/abc.avif')).toBe('image/avif');
  });

  it('未知扩展名回退为 application/octet-stream', () => {
    expect(contentTypeFromKey('2026/09/abc')).toBe('application/octet-stream');
  });
});

describe('imageStorageAvailable', () => {
  it('R2 与 KV 都未绑定时不可用', () => {
    expect(imageStorageAvailable({})).toBe(false);
    expect(imageStorageAvailable(null)).toBe(false);
  });

  it('绑定任意其一即可用', () => {
    expect(imageStorageAvailable({ IMAGES: new FakeR2() })).toBe(true);
    expect(imageStorageAvailable({ IMAGES_KV: new FakeKV() })).toBe(true);
  });
});

describe('putImage / getImage', () => {
  it('优先使用 R2', async () => {
    const r2 = new FakeR2();
    const kv = new FakeKV();
    await putImage({ IMAGES: r2, IMAGES_KV: kv }, '2026/09/a.png', PNG_BYTES, 'png');
    expect(r2.objects.has('2026/09/a.png')).toBe(true);
    expect(kv.entries.size).toBe(0);
  });

  it('未绑定 R2 时回退 KV', async () => {
    const kv = new FakeKV();
    await putImage({ IMAGES_KV: kv }, '2026/09/a.png', PNG_BYTES, 'png');
    expect(kv.entries.has('2026/09/a.png')).toBe(true);

    const found = await getImage({ IMAGES_KV: kv }, '2026/09/a.png');
    expect(found).not.toBeNull();
    expect(found?.contentType).toBe('image/png');
    expect(new Uint8Array(found!.body as ArrayBuffer)[0]).toBe(0x89);
  });

  it('R2 读取保留 contentType 与 etag', async () => {
    const r2 = new FakeR2();
    await putImage({ IMAGES: r2 }, '2026/09/b.jpg', PNG_BYTES, 'jpeg');
    const found = await getImage({ IMAGES: r2 }, '2026/09/b.jpg');
    expect(found?.contentType).toBe('image/jpeg');
    expect(found?.etag).toBe('fake-etag');
  });

  it('都不绑定时 getImage 返回 null', async () => {
    await expect(getImage({}, '2026/09/a.png')).resolves.toBeNull();
  });
});
