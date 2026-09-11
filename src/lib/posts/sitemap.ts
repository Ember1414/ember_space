export interface SitemapPost {
  slug: string;
  lang: 'zh' | 'en';
  tags: string[];
  pubDate: string;
  updatedDate: string | null;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function absoluteUrl(site: URL | string, pathname: string): string {
  return new URL(pathname, site).href;
}

export function renderPostSitemap(site: URL | string, posts: SitemapPost[]): string {
  const entries = new Map<string, string | null>();

  for (const post of posts) {
    const prefix = post.lang === 'en' ? '/en' : '';
    const postPath = `${prefix}/posts/${encodeURIComponent(post.slug)}/`;
    entries.set(postPath, post.updatedDate ?? post.pubDate);

    for (const tag of post.tags) {
      entries.set(`${prefix}/tags/${encodeURIComponent(tag)}/`, null);
    }
  }

  const urls = [...entries.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([pathname, lastmod]) => {
      const location = `<loc>${escapeXml(absoluteUrl(site, pathname))}</loc>`;
      const modified = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : '';
      return `<url>${location}${modified}</url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
