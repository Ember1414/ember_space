import { describe, expect, it } from 'vitest';
import { BIO_MAX, DISPLAY_NAME_MAX, validateBio, validateDisplayName } from './profile';

describe('validateDisplayName', () => {
  it('接受正常显示名并去除首尾空白', () => {
    expect(validateDisplayName(' Ember ')).toBe('Ember');
  });

  it('拒绝空名、超长名与非字符串', () => {
    expect(validateDisplayName('   ')).toBeNull();
    expect(validateDisplayName('x'.repeat(DISPLAY_NAME_MAX + 1))).toBeNull();
    expect(validateDisplayName(42)).toBeNull();
    expect(validateDisplayName(undefined)).toBeNull();
  });
});

describe('validateBio', () => {
  it('接受空简介与正常简介', () => {
    expect(validateBio('')).toBe('');
    expect(validateBio(' 记录技术与生活。 ')).toBe('记录技术与生活。');
  });

  it('拒绝超长简介与非字符串', () => {
    expect(validateBio('x'.repeat(BIO_MAX + 1))).toBeNull();
    expect(validateBio(null)).toBeNull();
  });
});
