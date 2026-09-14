import { describe, expect, it } from 'vitest';
import { isValidImageKey, MAX_IMAGE_BYTES, newImageKey, sniffImageFormat } from './images';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const AVIF = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66];

describe('sniffImageFormat', () => {
  it('识别各支持的图片格式', () => {
    expect(sniffImageFormat(new Uint8Array(PNG))).toBe('png');
    expect(sniffImageFormat(new Uint8Array(JPEG))).toBe('jpeg');
    expect(sniffImageFormat(new Uint8Array(GIF))).toBe('gif');
    expect(sniffImageFormat(new Uint8Array(WEBP))).toBe('webp');
    expect(sniffImageFormat(new Uint8Array(AVIF))).toBe('avif');
  });

  it('拒绝非图片内容与伪装文件', () => {
    expect(sniffImageFormat(new Uint8Array([0x4d, 0x5a]))).toBeNull(); // EXE
    expect(sniffImageFormat(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]))).toBeNull(); // <html
    expect(sniffImageFormat(new Uint8Array([]))).toBeNull();
    // RIFF 容器但不是 WEBP
    expect(sniffImageFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });
});

describe('newImageKey', () => {
  it('文章图按 UTC 年月分目录', () => {
    const key = newImageKey('png', undefined, new Date('2026-09-14T08:00:00Z'));
    expect(key).toMatch(/^2026\/09\/[0-9a-f-]{36}\.png$/);
  });

  it('jpeg 统一使用 jpg 扩展名', () => {
    expect(newImageKey('jpeg')).toMatch(/\.jpg$/);
  });

  it('头像按用户分目录', () => {
    const key = newImageKey('webp', { kind: 'avatar', userId: 'user-123' });
    expect(key).toMatch(/^avatars\/user-123\/[0-9a-f-]{36}\.webp$/);
  });
});

describe('isValidImageKey', () => {
  it('接受系统生成的 key', () => {
    expect(isValidImageKey(newImageKey('png'))).toBe(true);
    expect(isValidImageKey(newImageKey('avif', { kind: 'avatar', userId: 'abc-123' }))).toBe(true);
  });

  it('拒绝路径穿越与异常形态', () => {
    expect(isValidImageKey('../secret.png')).toBe(false);
    expect(isValidImageKey('2026/09/not-a-uuid.png')).toBe(false);
    expect(isValidImageKey('2026/09/123e4567-e89b-42d3-a456-426614174000.exe')).toBe(false);
    expect(isValidImageKey('2026/09/123e4567-e89b-42d3-a456-426614174000.png/extra')).toBe(false);
    expect(isValidImageKey('')).toBe(false);
  });
});

describe('MAX_IMAGE_BYTES', () => {
  it('上限为 5MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });
});
