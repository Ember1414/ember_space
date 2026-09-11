import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { SITE_I18N } from '../i18n/ui';
import { allowsStaticPostFallback, getPublishedPostSummaries, runtimeEnv } from '../lib/db';
import type { APIContext } from 'astro';

export const prerender = false;

export async function GET(context: APIContext) {
  const env = runtimeEnv(context.locals);
  if (env?.DB) {
    try {
      const posts = (await getPublishedPostSummaries(env, 'zh')) ?? [];
      return rss({
        title: SITE.title,
        description: SITE_I18N.zh.description,
        site: context.site ?? SITE.url,
        items: posts.map((post) => ({ title: post.title, description: post.description, pubDate: new Date(post.pubDate), link: `/posts/${post.slug}/`, categories: post.tags })),
        customData: '<language>zh-CN</language>',
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'public_content_read_failed',
        path: context.url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return new Response('RSS 暂时不可用，请稍后重试。', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      });
    }
  }
  if (!allowsStaticPostFallback(env)) {
    return new Response('RSS 暂时不可用，请稍后重试。', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    });
  }
  const posts = (await getCollection('posts', ({ data }) => !data.draft && data.lang === 'zh'))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: SITE.title,
    description: SITE_I18N.zh.description,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/posts/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: '<language>zh-CN</language>',
  });
}
