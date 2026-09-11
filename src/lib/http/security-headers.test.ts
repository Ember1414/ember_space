import { describe, expect, it } from 'vitest';
import { withAdminSecurityHeaders } from './security-headers';

describe('admin security headers', () => {
  it('denies framing for every admin response', () => {
    const response = withAdminSecurityHeaders(new Response('admin'), '/admin/posts/123/');

    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('does not alter public responses', () => {
    const original = new Response('public');
    const response = withAdminSecurityHeaders(original, '/posts/hello/');

    expect(response).toBe(original);
    expect(response.headers.has('content-security-policy')).toBe(false);
  });
});
