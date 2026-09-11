import { describe, expect, it } from 'vitest';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from './db';
import {
  escapeLikeTerm,
  highlightSearchExcerpt,
  markdownSearchText,
  parsePublicPostSearchInput,
  searchPublishedPosts,
  summarizeSearchText,
} from './search';

describe('public post search input', () => {
  it('normalizes a bounded query and applies the default limit', () => {
    const parsed = parsePublicPostSearchInput(new URLSearchParams({ q: '  Ａｓｔｒｏ\nD1  ', lang: 'en' }));
    expect(parsed).toEqual({ ok: true, value: { query: 'Astro D1', lang: 'en', limit: 10 } });
  });

  it('rejects missing language, empty queries, and excessive limits', () => {
    expect(parsePublicPostSearchInput(new URLSearchParams({ q: 'D1' })).ok).toBe(false);
    expect(parsePublicPostSearchInput(new URLSearchParams({ q: ' ', lang: 'zh' })).ok).toBe(false);
    expect(parsePublicPostSearchInput(new URLSearchParams({ q: 'D', lang: 'en' })).ok).toBe(false);
    expect(parsePublicPostSearchInput(new URLSearchParams({ q: 'D1', lang: 'zh', limit: '21' })).ok).toBe(false);
    expect(parsePublicPostSearchInput(new URLSearchParams({ q: 'x'.repeat(101), lang: 'zh' })).ok).toBe(false);
  });

  it('escapes LIKE metacharacters instead of treating them as wildcards', () => {
    expect(escapeLikeTerm('100%_done\\next')).toBe('100\\%\\_done\\\\next');
  });
});

describe('public post search excerpts', () => {
  it('extracts readable text from Markdown without exposing raw HTML', () => {
    const text = markdownSearchText('# Heading\n\nA **strong** [link](https://example.com).\n\n<script>alert(1)</script>');
    expect(text).toBe('Heading A strong link .');
    expect(text).not.toContain('script');
  });

  it('centers a bounded summary around the match', () => {
    const source = `Start ${'before '.repeat(30)}needle ${'after '.repeat(30)}end`;
    const summary = summarizeSearchText(source, 'needle', 80);
    expect(summary.length).toBeLessThanOrEqual(80);
    expect(summary).toContain('needle');
    expect(summary.startsWith('...')).toBe(true);
    expect(summary.endsWith('...')).toBe(true);
  });

  it('adds only escaped mark elements around case-insensitive matches', () => {
    expect(highlightSearchExcerpt('<img onerror=x> Astro & astro', 'astro')).toBe(
      '&lt;img onerror=x&gt; <mark>Astro</mark> &amp; <mark>astro</mark>',
    );
  });
});

describe('D1 public post search', () => {
  it('binds input, restricts rows to published posts and maps language routes', async () => {
    let sql = '';
    let bindings: unknown[] = [];
    const statement: D1PreparedStatementLike = {
      bind(...values) {
        bindings = values;
        return this;
      },
      async first<T>() {
        return null as T | null;
      },
      async all<T>() {
        return {
          results: [{ slug: 'cloudflare-search', title: 'Cloudflare Search', excerptSource: 'Fast search with D1.' }] as T[],
          success: true,
          meta: {},
        };
      },
      async run<T>() {
        return { results: [], success: true, meta: {} } as D1ResultLike<T>;
      },
    };
    const db: D1DatabaseLike = {
      prepare(query) {
        sql = query;
        return statement;
      },
      async batch() {
        return [];
      },
    };

    const results = await searchPublishedPosts(db, { query: "D1%' OR 1=1 --", lang: 'en', limit: 5 });

    expect(sql).toContain("p.status = 'published'");
    expect(sql).toContain('p.lang = search.language');
    expect(sql).not.toContain("D1%' OR 1=1 --");
    expect(bindings).toEqual(["D1%' OR 1=1 --", "%D1\\%' OR 1=1 --%", "D1\\%' OR 1=1 --%", 'en', 5]);
    expect(results[0]).toMatchObject({
      url: '/en/posts/cloudflare-search/',
      title: 'Cloudflare Search',
      type: 'posts',
      lang: 'en',
    });
  });
});
