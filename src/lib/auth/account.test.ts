import { describe, expect, it } from 'vitest';
import { normalizeAccount } from './account';

describe('account normalization', () => {
  it('uses the same Unicode and case normalization for registration and login', () => {
    expect(normalizeAccount('  Ｅditor@Example.COM  ')).toBe('editor@example.com');
    expect(normalizeAccount(null)).toBe('');
  });
});
