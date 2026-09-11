import { describe, expect, it } from 'vitest';
import { parseImportedMarkdown, parseImportedPost, postStatement } from './import-content.mjs';

const baseFrontmatter = {
  title: 'Imported post',
  description: 'Imported description',
  pubDate: '2026-09-11',
  tags: ['Astro'],
  lang: 'en',
  draft: false,
};

describe('Markdown content import', () => {
  it('rejects invalid calendar dates before YAML can normalize them', () => {
    expect(() => parseImportedPost(parseImportedMarkdown(`---
title: Imported post
description: Imported description
pubDate: 2026-02-31
---
# Imported
`, 'invalid-date.md'))).toThrow(/发布日期/);
  });

  it('uses the same metadata constraints as the admin API', () => {
    expect(() => parseImportedPost({
      slug: 'imported-post',
      file: 'imported-post.md',
      data: { ...baseFrontmatter, series: 'x'.repeat(121) },
      body: '# Imported',
    })).toThrow(/系列/);
  });

  it('rejects source-relative covers that cannot survive the D1 migration', () => {
    expect(() => parseImportedPost({
      slug: 'imported-post',
      file: 'imported-post.md',
      data: { ...baseFrontmatter, cover: '../../assets/cover.webp' },
      body: '# Imported',
    })).toThrow(/封面地址/);
  });

  it('normalizes valid frontmatter into a published post', () => {
    const post = parseImportedPost({
      slug: 'imported-post',
      file: 'imported-post.md',
      data: baseFrontmatter,
      body: '# Imported',
    });

    expect(post.status).toBe('published');
    expect(post.tags).toEqual(['Astro']);
    expect(post.body).toBe('# Imported');
  });

  it('advances the optimistic concurrency version when an existing slug is restored', () => {
    const post = parseImportedPost({
      slug: 'imported-post',
      file: 'imported-post.md',
      data: baseFrontmatter,
      body: '# Imported',
    });

    expect(postStatement(post, '2026-09-11T00:00:00.000Z')).toContain('version=posts.version + 1');
  });
});
