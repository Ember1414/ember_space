import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  hashPassword,
  PASSWORD_HASH_ITERATIONS,
  randomToken,
  sha256,
  verifyPassword,
} from './crypto';

describe('password hashing', () => {
  it('stays within the Cloudflare Workers PBKDF2 iteration limit', async () => {
    expect(PASSWORD_HASH_ITERATIONS).toBe(100_000);
    const digest = await hashPassword('cloudflare-compatible password');
    expect(digest.hash).toMatch(/^pbkdf2-sha256\$100000\$/);
  });

  it('verifies the right password and rejects a wrong password', async () => {
    const digest = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', digest.hash, digest.salt)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', digest.hash, digest.salt)).resolves.toBe(false);
  });

  it('uses a random salt for each password', async () => {
    const first = await hashPassword('same password');
    const second = await hashPassword('same password');
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });

  it('rejects malformed or downgraded hashes', async () => {
    await expect(verifyPassword('password', 'sha1$1$bad', 'bad')).resolves.toBe(false);
    await expect(verifyPassword('password', 'pbkdf2-sha256$99999$bad', 'bad')).resolves.toBe(false);
  });
});

describe('opaque tokens', () => {
  it('generates unique URL-safe values and hashes deterministically', async () => {
    const first = randomToken();
    const second = randomToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
    await expect(sha256(first)).resolves.toBe(await sha256(first));
  });

  it('compares secrets without accepting different lengths', async () => {
    await expect(constantTimeEqual('token', 'token')).resolves.toBe(true);
    await expect(constantTimeEqual('token', 'token-longer')).resolves.toBe(false);
    await expect(constantTimeEqual('', 'x')).resolves.toBe(false);
  });
});
