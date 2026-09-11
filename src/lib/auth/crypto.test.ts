import { describe, expect, it } from 'vitest';
import { constantTimeEqual, hashPassword, randomToken, sha256, verifyPassword } from './crypto';

describe('password hashing', () => {
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

  it('compares secrets without accepting different lengths', () => {
    expect(constantTimeEqual('token', 'token')).toBe(true);
    expect(constantTimeEqual('token', 'token-longer')).toBe(false);
    expect(constantTimeEqual('', 'x')).toBe(false);
  });
});

