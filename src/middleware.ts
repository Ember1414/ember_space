import { defineMiddleware } from 'astro:middleware';
import { withAdminSecurityHeaders } from './lib/http/security-headers';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  return withAdminSecurityHeaders(response, context.url.pathname);
});
