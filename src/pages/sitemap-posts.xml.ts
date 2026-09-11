import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { allowsStaticPostFallback, getPublishedPostSummaries, runtimeEnv } from '../lib/db';
import { renderPostSitemap, type SitemapPost } from '../lib/posts/sitemap';

export const prerender = false;

function unavailable(): Response {
  return new Response('Sitemap is temporarily unavailable.', {
    status: 503,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '60',
    },
  });
}

export async function GET(context: APIContext): Promise<Response> {
  const env = runtimeEnv(context.locals);
  let posts: SitemapPost[];

  if (env?.DB) {
    try {
      posts = (await getPublishedPostSummaries(env)) ?? [];
    } catch (error) {
      console.error(JSON.stringify({
        event: 'sitemap_content_read_failed',
        path: context.url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return unavailable();
    }
  } else if (allowsStaticPostFallback(env)) {
    posts = (await getCollection('posts', ({ data }) => !data.draft)).map((post) => ({
      slug: post.id,
      lang: post.data.lang,
      tags: post.data.tags,
      pubDate: post.data.pubDate.toISOString(),
      updatedDate: post.data.updatedDate?.toISOString() ?? null,
    }));
  } else {
    return unavailable();
  }

  return new Response(renderPostSitemap(context.site ?? SITE.url, posts), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
}
