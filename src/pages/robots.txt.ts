import type { APIContext } from 'astro';
import { SITE } from '../consts';

export const prerender = false;

export function GET(context: APIContext): Response {
  const site = context.site ?? SITE.url;
  const body = [
    'User-agent: *',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', site).href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
