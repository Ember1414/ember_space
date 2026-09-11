export function withAdminSecurityHeaders(response: Response, pathname: string): Response {
  if (!pathname.startsWith('/admin/')) return response;

  const headers = new Headers(response.headers);
  headers.set('content-security-policy', "frame-ancestors 'none'");
  headers.set('x-frame-options', 'DENY');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
