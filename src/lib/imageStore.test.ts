import { describe, expect, it } from 'vitest';
import { contentTypeFromKey, deleteImage, getImage, imageStorageAvailable, listImages, putImage } from './imageStore';
import type { KVNamespaceLike, R2BucketLike } from './db';

class FakeR2 implements R2BucketLike {
  objects = new Map<string, { bytes: Uint8Array; contentType?: string; uploaded: Date }>();

  async put(key: string, value: Uint8Array | ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }) {
    const bytes = value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array();
    this.objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType, uploaded: new Date() });
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

  async delete(key: string) {
    this.objects.delete(key);
  }

  async list(options?: { limit?: number }) {
    const objects = [...this.objects.entries()]
      .slice(0, options?.limit ?? 200)
      .map(([key, value]) => ({ key, uploaded: value.uploaded, size: value.bytes.length }));
    return { objects, truncated: false };
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

  async delete(key: string) {
    this.entries.delete(key);
  }

  async list(options?: { limit?: number }) {
    const keys = [...this.entries.keys()].sort().slice(0, options?.limit ?? 200).map((name) => ({ name }));
    return { keys, list_complete: true };
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

describe('listImages / deleteImage', () => {
  it('R2 列举并按上传时间倒序', async () => {
    const r2 = new FakeR2();
    await putImage({ IMAGES: r2 }, '2026/01/old.png', PNG_BYTES, 'png');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await putImage({ IMAGES: r2 }, '2026/02/new.png', PNG_BYTES, 'png');
    const images = await listImages({ IMAGES: r2 });
    expect(images.map((image) => image.key)).toEqual(['2026/02/new.png', '2026/01/old.png']);
    expect(images[0].size).toBe(PNG_BYTES.length);
  });

  it('KV 列举返回倒序 key', async () => {
    const kv = new FakeKV();
    await putImage({ IMAGES_KV: kv }, '2026/01/a.png', PNG_BYTES, 'png');
    await putImage({ IMAGES_KV: kv }, '2026/02/b.png', PNG_BYTES, 'png');
    const images = await listImages({ IMAGES_KV: kv });
    expect(images.map((image) => image.key)).toEqual(['2026/02/b.png', '2026/01/a.png']);
  });

  it('删除后无法再读取', async () => {
    const kv = new FakeKV();
    await putImage({ IMAGES_KV: kv }, '2026/09/a.png', PNG_BYTES, 'png');
    await deleteImage({ IMAGES_KV: kv }, '2026/09/a.png');
    await expect(getImage({ IMAGES_KV: kv }, '2026/09/a.png')).resolves.toBeNull();
    expect(await listImages({ IMAGES_KV: kv })).toEqual([]);
  });

  it('都不绑定时列举返回空数组、删除抛错', async () => {
    await expect(listImages({})).resolves.toEqual([]);
    await expect(deleteImage({}, '2026/09/a.png')).rejects.toThrow('image storage unavailable');
  });
});
