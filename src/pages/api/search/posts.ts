import type { APIRoute } from 'astro';
import { runtimeEnv } from '../../../lib/db';
import { parsePublicPostSearchInput, searchPublishedPosts } from '../../../lib/search';

export const prerender = false;

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function unavailable(): Response {
  return json(
    { error: 'Search is temporarily unavailable.' },
    503,
    { 'Retry-After': '60' },
  );
}

export const GET: APIRoute = async (context) => {
  const parsed = parsePublicPostSearchInput(context.url.searchParams);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const env = runtimeEnv(context.locals);
  if (!env.DB) return unavailable();

  try {
    const results = await searchPublishedPosts(env.DB, parsed.value);
    return json({ results });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'public_search_failed',
      path: context.url.pathname,
      error: error instanceof Error ? error.message : String(error),
    }));
    return unavailable();
  }
};
