import { describe, expect, it, vi } from 'vitest';
import {
  getPublishedTranslationSlug,
  getPublishedPostSummaries,
  getPublishedPostSummariesByTag,
  hasPublishedPostWithTag,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
} from './db';

vi.mock('cloudflare:workers', () => ({ env: {} }));

function fakeDatabase(rows: Record<string, unknown>[]) {
  let query = '';
  let bindings: unknown[] = [];
  const statement: D1PreparedStatementLike = {
    bind(...values) {
      bindings = values;
      return statement;
    },
    async first<T>() {
      return (rows[0] as T | undefined) ?? null;
    },
    async all<T>() {
      return { results: rows as T[], success: true, meta: {} };
    },
    async run<T>() {
      return { results: [] as T[], success: true, meta: {} };
    },
  };
  const db: D1DatabaseLike = {
    prepare(sql) {
      query = sql;
      return statement;
    },
    async batch() {
      return [];
    },
  };
  return { db, query: () => query, bindings: () => bindings };
}

const row = {
  id: 'post-1',
  slug: 'hello-world',
  title: 'Hello',
  description: 'Summary',
  bodyLength: 1234,
  pubDate: '2026-09-01',
  updatedDate: null,
  tags: '["Astro"]',
  lang: 'zh',
  cover: null,
  coverAlt: null,
  featured: 0,
  series: null,
  translationKey: null,
  status: 'published',
  authorId: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('published post summaries', () => {
  it('selects metadata and body length without returning article bodies', async () => {
    const fake = fakeDatabase([row]);
    const posts = await getPublishedPostSummaries({ DB: fake.db }, 'zh');

    expect(fake.query()).toContain('length(body) AS bodyLength');
    expect(fake.query()).not.toContain('description, body,');
    expect(fake.bindings()).toEqual(['published', 'zh']);
    expect(posts?.[0]).toMatchObject({ slug: 'hello-world', bodyLength: 1234, tags: ['Astro'] });
    expect(posts?.[0]).not.toHaveProperty('body');
  });

  it('binds tags instead of interpolating them into SQL', async () => {
    const fake = fakeDatabase([row]);
    await getPublishedPostSummariesByTag({ DB: fake.db }, 'zh', "D1' OR 1=1 --");

    expect(fake.query()).toContain('json_each.value = ?');
    expect(fake.query()).not.toContain("D1' OR 1=1 --");
    expect(fake.bindings()).toEqual(['zh', "D1' OR 1=1 --"]);
  });

  it('finds only a published translation in the requested language', async () => {
    const fake = fakeDatabase([{ slug: 'english-note' }]);
    await expect(getPublishedTranslationSlug({ DB: fake.db }, 'paired-note', 'en'))
      .resolves.toBe('english-note');

    expect(fake.query()).toContain("status = 'published'");
    expect(fake.query()).toContain('translation_key = ?');
    expect(fake.bindings()).toEqual(['paired-note', 'en']);
  });

  it('checks alternate-language tag availability without loading post bodies', async () => {
    const fake = fakeDatabase([{ found: 1 }]);
    await expect(hasPublishedPostWithTag({ DB: fake.db }, 'en', 'Astro'))
      .resolves.toBe(true);

    expect(fake.query()).toContain('SELECT 1 AS found');
    expect(fake.query()).toContain('json_each.value = ?');
    expect(fake.bindings()).toEqual(['en', 'Astro']);
  });
});
