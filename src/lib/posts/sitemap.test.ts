import { describe, expect, it } from 'vitest';
import { renderPostSitemap } from './sitemap';

describe('renderPostSitemap', () => {
  it('renders localized post and encoded tag URLs', () => {
    const xml = renderPostSitemap('https://example.com', [
      { slug: 'hello-world', lang: 'zh', tags: ['Astro & D1'], pubDate: '2026-09-01', updatedDate: null },
      { slug: 'english-note', lang: 'en', tags: ['Cloudflare'], pubDate: '2026-09-02', updatedDate: '2026-09-03' },
    ]);

    expect(xml).toContain('<loc>https://example.com/posts/hello-world/</loc><lastmod>2026-09-01</lastmod>');
    expect(xml).toContain('<loc>https://example.com/en/posts/english-note/</loc><lastmod>2026-09-03</lastmod>');
    expect(xml).toContain('<loc>https://example.com/tags/Astro%20%26%20D1/</loc>');
  });

  it('deduplicates tag URLs', () => {
    const xml = renderPostSitemap('https://example.com', [
      { slug: 'one', lang: 'zh', tags: ['Astro'], pubDate: '2026-09-01', updatedDate: null },
      { slug: 'two', lang: 'zh', tags: ['Astro'], pubDate: '2026-09-02', updatedDate: null },
    ]);

    expect(xml.match(/\/tags\/Astro\//g)).toHaveLength(1);
  });
});
